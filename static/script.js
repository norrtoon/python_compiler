// Инициализация элементов
        const socket = io();
        const codeArea = document.getElementById('code');
        const runBtn = document.getElementById('runBtn');
        const btnText = document.getElementById('btnText');
        const outputDiv = document.getElementById('output');
        const outputPanel = document.getElementById('outputPanel');
        const inputContainer = document.getElementById('input-container');
        const inputBox = document.getElementById('inputBox');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const menuToggle = document.getElementById('menuToggle');
        const dropdownMenu = document.getElementById('dropdownMenu');
        const toast = document.getElementById('toast');
        const toastText = document.getElementById('toastText');

        // Dropdown Menu Logic
        menuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdownMenu.classList.toggle('open');
        });

        document.addEventListener('click', function(e) {
            if (!dropdownMenu.contains(e.target) && e.target !== menuToggle) {
                dropdownMenu.classList.remove('open');
            }
        });

        // Download Function
        document.getElementById('downloadBtn').addEventListener('click', function() {
            const code = codeArea.value;
            const blob = new Blob([code], { type: 'text/x-python' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = 'main.py';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            dropdownMenu.classList.remove('open');
            showToast('Файл скачан');
        });

        // Copy Function
        document.getElementById('copyBtn').addEventListener('click', function() {
            navigator.clipboard.writeText(codeArea.value).then(function() {
                dropdownMenu.classList.remove('open');
                showToast('Код скопирован');
            });
        });

        // Clear Function
        document.getElementById('clearBtn').addEventListener('click', function() {
            codeArea.value = '';
            dropdownMenu.classList.remove('open');
            codeArea.focus();
        });

        // Load Example
        document.getElementById('exampleBtn').addEventListener('click', function() {
            codeArea.value = `# Пример: калькулятор
def calculator():
    print("Простой калькулятор")
    a = float(input("Число 1: "))
    op = input("Операция (+, -, *, /): ")
    b = float(input("Число 2: "))
    
    if op == '+':
        result = a + b
    elif op == '-':
        result = a - b
    elif op == '*':
        result = a * b
    elif op == '/':
        result = a / b if b != 0 else "Ошибка: деление на ноль"
    else:
        result = "Неизвестная операция"
    
    print(f"Результат: {result}")

calculator()`;
            dropdownMenu.classList.remove('open');
            showToast('Пример загружен');
        });

        // Toast Function
        function showToast(message) {
            toastText.textContent = message;
            toast.classList.add('show');
            setTimeout(function() {
                toast.classList.remove('show');
            }, 2500);
        }

        // Run Code
        function runCode() {
            const code = codeArea.value;
            
            outputDiv.textContent = '';
            outputPanel.classList.add('visible');
            outputPanel.classList.remove('has-error');
            runBtn.disabled = true;
            btnText.textContent = 'Выполняю...';
            
            statusDot.classList.add('running');
            statusDot.classList.remove('error');
            statusText.textContent = 'Выполняется';
            
            inputContainer.classList.remove('hidden');
            inputBox.disabled = true;
            inputBox.value = '';

            

            socket.emit('run', { code: code });
        }

        runBtn.addEventListener('click', runCode);

        // Socket Events 
        socket.on('output', function(msg) {
            outputDiv.textContent += msg.data + '\n';
            
            if (msg.data && (msg.data.includes('Error') || msg.data.includes('Traceback'))) {
                outputPanel.classList.add('has-error');
                statusDot.classList.add('error');
                statusDot.classList.remove('running');
                statusText.textContent = 'Ошибка';
            }
            
            outputDiv.scrollTop = outputDiv.scrollHeight;
        });

        socket.on('status', function(msg) {
            if (msg.status === 'finished') {
                runBtn.disabled = false;
                btnText.textContent = 'Запустить код';
                inputBox.disabled = true;
                
                statusDot.classList.remove('running');
                statusDot.classList.remove('error');
                statusText.textContent = 'Готов к запуску';
            } else if (msg.status === 'waiting_input') {
                inputBox.disabled = false;
                inputBox.focus();
            } else if (msg.status === 'running') {
                inputBox.disabled = true;
            }
        });

        inputBox.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !inputBox.disabled) {
                const val = inputBox.value;
                
                outputDiv.textContent += '> ' + val + '\n';
                socket.emit('input', { data: val });
                
                inputBox.value = '';
                inputBox.disabled = true;
            }
        });

        socket.on('connect', function() {
            
        });

        socket.on('connect_error', function() {
            
            outputDiv.textContent = 'Ошибка соединения с сервером.';
            outputPanel.classList.add('visible');
            outputPanel.classList.add('has-error');
            runBtn.disabled = false;
            btnText.textContent = 'Запустить код';
            
            statusDot.classList.add('error');
            statusDot.classList.remove('running');
            statusText.textContent = 'Нет соединения';
        });

        // Keyboard Shortcut
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter' && !runBtn.disabled) {
                runCode();
            }
        });

// Нумерация строк
function updateLineNumbers() {
    const lines = codeArea.value.split('\n').length;
    const numbers = Array.from({length: lines}, (_, i) => `<span>${i + 1}</span>`).join('');
    document.getElementById('lineNumbers').innerHTML = numbers;
}

function syncScroll() {
    document.getElementById('lineNumbers').scrollTop = codeArea.scrollTop;
}

codeArea.addEventListener('input', updateLineNumbers);
codeArea.addEventListener('scroll', syncScroll);
codeArea.addEventListener('keydown', function(e) {
    // Tab -> 4 пробела
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = codeArea.selectionStart;
        const end = codeArea.selectionEnd;
        codeArea.value = codeArea.value.substring(0, start) + '    ' + codeArea.value.substring(end);
        codeArea.selectionStart = codeArea.selectionEnd = start + 4;
        updateLineNumbers();
    }
});

// Инициализация при загрузке
updateLineNumbers();