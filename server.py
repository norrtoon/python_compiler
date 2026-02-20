import eventlet
eventlet.monkey_patch()

import subprocess
import queue
import threading
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

active_processes = {}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    print(f'[+] Клиент подключён: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    process = active_processes.pop(sid, None)
    if process and process.poll() is None:
        process.kill()
    print(f'[-] Клиент отключён: {sid}')

@socketio.on('run')
def handle_run(data):
    sid = request.sid
    code = data.get('code', '')

    old = active_processes.pop(sid, None)
    if old and old.poll() is None:
        old.kill()

    filepath = '/tmp/script.py'
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)

    try:
        process = subprocess.Popen(
            ['python3', '-u', filepath],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            text=True,
            bufsize=0
        )
        active_processes[sid] = process
        output_queue = queue.Queue()

        def enqueue_stream(stream, q):
            try:
                for line in iter(stream.readline, ''):
                    q.put(('out', line))
            finally:
                q.put(('done', None))

        t_out = threading.Thread(target=enqueue_stream, args=(process.stdout, output_queue), daemon=True)
        t_err = threading.Thread(target=enqueue_stream, args=(process.stderr, output_queue), daemon=True)
        t_out.start()
        t_err.start()

        def read_output():
            done_count = 0
            idle_ticks = 0

            while done_count < 2:
                try:
                    kind, line = output_queue.get_nowait()
                    if kind == 'done':
                        done_count += 1
                    elif line:
                        socketio.emit('output', {'data': line.rstrip()}, to=sid)
                        idle_ticks = 0
                except queue.Empty:
                    idle_ticks += 1
                    # ~500мс тишины + процесс жив = ждёт input()
                    if idle_ticks >= 10 and process.poll() is None:
                        socketio.emit('status', {'status': 'waiting_input'}, to=sid)
                        idle_ticks = 0

                eventlet.sleep(0.05)

            while not output_queue.empty():
                try:
                    kind, line = output_queue.get_nowait()
                    if kind == 'out' and line:
                        socketio.emit('output', {'data': line.rstrip()}, to=sid)
                except queue.Empty:
                    break

            active_processes.pop(sid, None)
            socketio.emit('status', {'status': 'finished'}, to=sid)

        eventlet.spawn(read_output)

    except Exception as e:
        emit('output', {'data': f'Server Error: {str(e)}'})
        emit('status', {'status': 'finished'})

@socketio.on('input')
def handle_input(data):
    sid = request.sid
    process = active_processes.get(sid)
    if process and process.poll() is None:
        try:
            process.stdin.write(data.get('data', '') + '\n')
            process.stdin.flush()
            socketio.emit('status', {'status': 'running'}, to=sid)
        except Exception as e:
            emit('output', {'data': f'Input Error: {str(e)}'})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
