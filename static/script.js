// Инициализация
const socket = io();
const codeArea = document.getElementById('code');
const highlighted = document.getElementById('highlighted');
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
const lineNumbers = document.getElementById('lineNumbers');
const indentLevelEl = document.getElementById('indentLevel');

// Настройка отступов
const INDENT_SIZE = 4;
const INDENT_STRING = ' '.repeat(INDENT_SIZE);

const DEDENT_KEYWORDS = ['return', 'break', 'continue', 'pass', 'raise'];

// Подсветка синтаксиса
// Python ключевые слова
const KEYWORDS = [
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
    'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
    'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
    'while', 'with', 'yield', 'match', 'case'
];

// Встроенные функции
const BUILTINS = [
    'print', 'input', 'len', 'range', 'int', 'str', 'float', 'list',
    'dict', 'set', 'tuple', 'bool', 'type', 'isinstance', 'hasattr',
    'getattr', 'setattr', 'delattr', 'open', 'file', 'abs', 'all',
    'any', 'bin', 'chr', 'dir', 'divmod', 'enumerate', 'eval', 'exec',
    'filter', 'format', 'frozenset', 'globals', 'hash', 'help', 'hex',
    'id', 'iter', 'locals', 'map', 'max', 'min', 'next', 'object',
    'oct', 'ord', 'pow', 'repr', 'reversed', 'round', 'slice',
    'sorted', 'staticmethod', 'sum', 'super', 'vars', 'zip', '__import__',
    'classmethod', 'property', 'Exception', 'BaseException', 'ValueError',
    'TypeError', 'KeyError', 'IndexError', 'AttributeError', 'ImportError',
    'RuntimeError', 'StopIteration', 'ZeroDivisionError', 'FileNotFoundError'
];

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Подсветка Python кода
function highlightPython(code) {
    // Сначала экранируем весь код
    let result = '';
    let i = 0;
    
    while (i < code.length) {
        // Проверяем комментарии
        if (code[i] === '#') {
            let end = code.indexOf('\n', i);
            if (end === -1) end = code.length;
            const comment = escapeHtml(code.slice(i, end));
            result += `<span class="token comment">${comment}</span>`;
            i = end;
            continue;
        }
        
        // Проверяем многострочные строки (тройные кавычки)
        if (code.slice(i, i + 3) === '"""' || code.slice(i, i + 3) === "'''") {
            const quote = code.slice(i, i + 3);
            let end = code.indexOf(quote, i + 3);
            if (end === -1) end = code.length - 3;
            end += 3;
            const str = escapeHtml(code.slice(i, end));
            result += `<span class="token string">${str}</span>`;
            i = end;
            continue;
        }
        
        // Проверяем f-строки
        if ((code[i] === 'f' || code[i] === 'F') && (code[i + 1] === '"' || code[i + 1] === "'")) {
            const quote = code[i + 1];
            let end = i + 2;
            let str = code.slice(i, i + 2);
            
            while (end < code.length) {
                if (code[end] === '\\' && end + 1 < code.length) {
                    str += code.slice(end, end + 2);
                    end += 2;
                } else if (code[end] === quote) {
                    str += quote;
                    end++;
                    break;
                } else {
                    str += code[end];
                    end++;
                }
            }
            
            // Подсвечиваем f-строку с выражениями
            const highlighted = highlightFString(str);
            result += highlighted;
            i = end;
            continue;
        }
        
        // Проверяем обычные строки
        if (code[i] === '"' || code[i] === "'") {
            const quote = code[i];
            let end = i + 1;
            while (end < code.length) {
                if (code[end] === '\\' && end + 1 < code.length) {
                    end += 2;
                } else if (code[end] === quote) {
                    end++;
                    break;
                } else if (code[end] === '\n') {
                    break;
                } else {
                    end++;
                }
            }
            const str = escapeHtml(code.slice(i, end));
            result += `<span class="token string">${str}</span>`;
            i = end;
            continue;
        }
        
        // Проверяем числа
        if (/[0-9]/.test(code[i]) || (code[i] === '.' && /[0-9]/.test(code[i + 1]))) {
            let end = i;
            // Hex, octal, binary
            if (code[i] === '0' && code[i + 1] && /[xXoObB]/.test(code[i + 1])) {
                end += 2;
                while (end < code.length && /[0-9a-fA-F_]/.test(code[end])) end++;
            } else {
                while (end < code.length && /[0-9_.]/.test(code[end])) end++;
                // Научная нотация
                if (code[end] === 'e' || code[end] === 'E') {
                    end++;
                    if (code[end] === '+' || code[end] === '-') end++;
                    while (end < code.length && /[0-9_]/.test(code[end])) end++;
                }
                // j для комплексных чисел
                if (code[end] === 'j' || code[end] === 'J') end++;
            }
            const num = escapeHtml(code.slice(i, end));
            result += `<span class="token number">${num}</span>`;
            i = end;
            continue;
        }
        
        // Проверяем декораторы
        if (code[i] === '@') {
            let end = i + 1;
            while (end < code.length && /[a-zA-Z0-9_.]/.test(code[end])) end++;
            const decorator = escapeHtml(code.slice(i, end));
            result += `<span class="token decorator">${decorator}</span>`;
            i = end;
            continue;
        }
        
        // Проверяем идентификаторы и ключевые слова
        if (/[a-zA-Z_]/.test(code[i])) {
            let end = i;
            while (end < code.length && /[a-zA-Z0-9_]/.test(code[end])) end++;
            const word = code.slice(i, end);
            const escaped = escapeHtml(word);
            
            if (word === 'self' || word === 'cls') {
                result += `<span class="token self">${escaped}</span>`;
            } else if (word === 'True' || word === 'False') {
                result += `<span class="token boolean">${escaped}</span>`;
            } else if (word === 'None') {
                result += `<span class="token none">${escaped}</span>`;
            } else if (KEYWORDS.includes(word)) {
                result += `<span class="token keyword">${escaped}</span>`;
            } else if (BUILTINS.includes(word)) {
                result += `<span class="token builtin">${escaped}</span>`;
            } else if (code[end] === '(') {
                // Вызов функции
                result += `<span class="token function">${escaped}</span>`;
            } else {
                result += escaped;
            }
            i = end;
            continue;
        }
        
        // Операторы
        if (/[+\-*/%=<>!&|^~:]/.test(code[i])) {
            let op = code[i];
            // Двухсимвольные операторы
            if (i + 1 < code.length) {
                const twoChar = code.slice(i, i + 2);
                if (['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '//=', '%=', '**=', 
                     '&=', '|=', '^=', '>>=', '<<=', '->', ':=', '**', '//', '<<', '>>', 
                     '&&', '||'].includes(twoChar)) {
                    op = twoChar;
                }
            }
            result += `<span class="token operator">${escapeHtml(op)}</span>`;
            i += op.length;
            continue;
        }
        
        // Скобки и пунктуация
        if (/[(){}\[\],.;]/.test(code[i])) {
            result += `<span class="token punctuation">${escapeHtml(code[i])}</span>`;
            i++;
            continue;
        }
        
        // Остальные символы (пробелы, переносы и т.д.)
        result += escapeHtml(code[i]);
        i++;
    }
    
    return result;
}

// Подсветка f-строки с выражениями внутри {}

function highlightFString(fstr) {
    let result = '<span class="token string">';
    let i = 0;
    
    while (i < fstr.length) {
        if (fstr[i] === '{' && fstr[i + 1] !== '{') {
            // Начало выражения
            let braceCount = 1;
            let end = i + 1;
            
            while (end < fstr.length && braceCount > 0) {
                if (fstr[end] === '{') braceCount++;
                else if (fstr[end] === '}') braceCount--;
                end++;
            }
            
            const expr = fstr.slice(i, end);
            result += `</span><span class="token fstring-expr">${escapeHtml(expr)}</span><span class="token string">`;
            i = end;
        } else {
            result += escapeHtml(fstr[i]);
            i++;
        }
    }
    
    result += '</span>';
    return result;
}

// Обновление подсветки

function updateHighlight() {
    const code = codeArea.value;
    highlighted.innerHTML = highlightPython(code) + '\n'; // +\n чтобы высота совпадала
}

//Синхронизация скролла между textarea и подсветкой
function syncScroll() {
    highlighted.scrollTop = codeArea.scrollTop;
    highlighted.scrollLeft = codeArea.scrollLeft;
    lineNumbers.scrollTop = codeArea.scrollTop;
}

// Функции отступов

function getIndentLevel(line) {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
}

function endsWithColon(line) {
    const withoutComment = line.replace(/#.*$/, '').trim();
    return withoutComment.endsWith(':');
}

function isDedentLine(line) {
    const trimmed = line.trim();
    const firstWord = trimmed.split(/[\s(]/)[0];
    return DEDENT_KEYWORDS.includes(firstWord);
}

function calculateNewIndent(prevLine) {
    const prevIndent = getIndentLevel(prevLine);
    const trimmedPrev = prevLine.trim();

    if (!trimmedPrev) return 0;
    if (endsWithColon(prevLine)) return prevIndent + INDENT_SIZE;
    if (isDedentLine(prevLine)) return Math.max(0, prevIndent - INDENT_SIZE);
    return prevIndent;
}

function handleEnter(e) {
    e.preventDefault();

    const start = codeArea.selectionStart;
    const end = codeArea.selectionEnd;
    const value = codeArea.value;

    const beforeCursor = value.substring(0, start);
    const afterCursor = value.substring(end);
    
    const lines = beforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];

    const newIndent = calculateNewIndent(currentLine);
    const newIndentStr = ' '.repeat(newIndent);

    codeArea.value = beforeCursor + '\n' + newIndentStr + afterCursor;

    const newCursorPos = start + 1 + newIndent;
    codeArea.selectionStart = codeArea.selectionEnd = newCursorPos;

    updateAll();
}

function handleTab(e) {
    e.preventDefault();

    const start = codeArea.selectionStart;
    const end = codeArea.selectionEnd;
    const value = codeArea.value;

    if (start !== end) {
        const beforeSelection = value.substring(0, start);
        const lineStart = beforeSelection.lastIndexOf('\n') + 1;
        const selectedText = value.substring(lineStart, end);
        const afterSelection = value.substring(end);

        const indentedLines = selectedText
            .split('\n')
            .map(line => INDENT_STRING + line)
            .join('\n');

        codeArea.value = value.substring(0, lineStart) + indentedLines + afterSelection;
        codeArea.selectionStart = lineStart;
        codeArea.selectionEnd = lineStart + indentedLines.length;
    } else {
        codeArea.value = value.substring(0, start) + INDENT_STRING + value.substring(end);
        codeArea.selectionStart = codeArea.selectionEnd = start + INDENT_SIZE;
    }

    updateAll();
}

function handleShiftTab(e) {
    e.preventDefault();

    const start = codeArea.selectionStart;
    const end = codeArea.selectionEnd;
    const value = codeArea.value;

    const beforeCursor = value.substring(0, start);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;

    function dedentLine(line) {
        if (line.startsWith(INDENT_STRING)) return line.substring(INDENT_SIZE);
        if (line.startsWith('\t')) return line.substring(1);
        const match = line.match(/^(\s+)/);
        if (match) {
            const toRemove = Math.min(match[1].length, INDENT_SIZE);
            return line.substring(toRemove);
        }
        return line;
    }

    if (start !== end) {
        const selectedText = value.substring(lineStart, end);
        const afterSelection = value.substring(end);

        const dedentedLines = selectedText.split('\n').map(dedentLine).join('\n');

        codeArea.value = value.substring(0, lineStart) + dedentedLines + afterSelection;
        codeArea.selectionStart = lineStart;
        codeArea.selectionEnd = lineStart + dedentedLines.length;
    } else {
        const lineEnd = value.indexOf('\n', start);
        const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;
        const currentLine = value.substring(lineStart, actualLineEnd);
        
        const newLine = dedentLine(currentLine);
        const removed = currentLine.length - newLine.length;

        codeArea.value = value.substring(0, lineStart) + newLine + value.substring(actualLineEnd);
        codeArea.selectionStart = codeArea.selectionEnd = Math.max(lineStart, start - removed);
    }

    updateAll();
}

function handleBackspace(e) {
    const start = codeArea.selectionStart;
    const end = codeArea.selectionEnd;

    if (start !== end) return;

    const value = codeArea.value;
    const beforeCursor = value.substring(0, start);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const lineBeforeCursor = value.substring(lineStart, start);

    if (/^\s+$/.test(lineBeforeCursor) && lineBeforeCursor.length >= INDENT_SIZE) {
        e.preventDefault();
        const removeCount = lineBeforeCursor.length % INDENT_SIZE || INDENT_SIZE;
        codeArea.value = value.substring(0, start - removeCount) + value.substring(start);
        codeArea.selectionStart = codeArea.selectionEnd = start - removeCount;
        updateAll();
    }
}

function handleAutoDedent() {
    const start = codeArea.selectionStart;
    const value = codeArea.value;
    const beforeCursor = value.substring(0, start);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const currentLine = value.substring(lineStart, start);
    const trimmed = currentLine.trim();

    const continuationKeywords = ['elif', 'else', 'except', 'finally', 'case'];
    
    const matchedKeyword = continuationKeywords.find(kw => 
        trimmed === kw || trimmed.startsWith(kw + ' ') || trimmed.startsWith(kw + ':')
    );

    if (!matchedKeyword) return;

    const currentIndent = getIndentLevel(currentLine);
    const lines = value.substring(0, lineStart).split('\n');

    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const indent = getIndentLevel(line);
        const lineTrimmed = line.trim();

        if (!lineTrimmed) continue;

        if (indent < currentIndent && endsWithColon(line)) {
            const lineEnd = value.indexOf('\n', start);
            const restOfLine = lineEnd === -1 ? value.substring(start) : value.substring(start, lineEnd);
            const afterLine = lineEnd === -1 ? '' : value.substring(lineEnd);

            const newLine = ' '.repeat(indent) + trimmed + restOfLine.trimStart();
            
            codeArea.value = value.substring(0, lineStart) + newLine + afterLine;
            
            const newCursorPos = lineStart + indent + trimmed.length;
            codeArea.selectionStart = codeArea.selectionEnd = newCursorPos;
            
            updateAll();
            break;
        }
    }
}

function updateLineNumbers() {
    const lines = codeArea.value.split('\n').length;
    const numbers = Array.from({length: lines}, (_, i) => `<span>${i + 1}</span>`).join('');
    lineNumbers.innerHTML = numbers;
}

function updateIndentIndicator() {
    if (!indentLevelEl) return;
    
    const start = codeArea.selectionStart;
    const value = codeArea.value;
    const beforeCursor = value.substring(0, start);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const currentLine = value.substring(lineStart, start);
    const indent = getIndentLevel(currentLine);
    
    indentLevelEl.textContent = Math.floor(indent / INDENT_SIZE);
}

function updateAll() {
    updateLineNumbers();
    updateHighlight();
    updateIndentIndicator();
}

// Обработчики редактора
codeArea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        handleEnter(e);
    } else if (e.key === 'Tab' && !e.shiftKey) {
        handleTab(e);
    } else if (e.key === 'Tab' && e.shiftKey) {
        handleShiftTab(e);
    } else if (e.key === 'Backspace') {
        handleBackspace(e);
    }
});

codeArea.addEventListener('input', function() {
    updateAll();
    setTimeout(handleAutoDedent, 10);
});

codeArea.addEventListener('scroll', syncScroll);
codeArea.addEventListener('click', updateIndentIndicator);
codeArea.addEventListener('keyup', updateIndentIndicator);

// Dropdown menu

menuToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdownMenu.classList.toggle('open');
});

document.addEventListener('click', function(e) {
    if (!dropdownMenu.contains(e.target) && e.target !== menuToggle) {
        dropdownMenu.classList.remove('open');
    }
});

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

document.getElementById('copyBtn').addEventListener('click', function() {
    navigator.clipboard.writeText(codeArea.value).then(function() {
        dropdownMenu.classList.remove('open');
        showToast('Код скопирован');
    });
});

document.getElementById('clearBtn').addEventListener('click', function() {
    codeArea.value = '';
    updateAll();
    dropdownMenu.classList.remove('open');
    codeArea.focus();
});

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
        result = a / b if b != 0 else "Ошибка"
    else:
        result = "Неизвестная операция"
    
    print(f"Результат: {result}")

calculator()`;
    updateAll();
    dropdownMenu.classList.remove('open');
    showToast('Пример загружен');
});

// Toast

function showToast(message) {
    toastText.textContent = message;
    toast.classList.add('show');
    setTimeout(function() {
        toast.classList.remove('show');
    }, 2500);
}

// Запуск кода

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

// Socket.io

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

document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter' && !runBtn.disabled) {
        runCode();
    }
});

// Инициализация
updateAll();