# Базовый образ
FROM python:3.11-slim

# Рабочая директория 
WORKDIR /app

# Зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем проект
COPY server.py .
COPY templates/ ./templates/
COPY static/ ./static/

# Порт 
EXPOSE 5000

# Запуск 
CMD ["python", "server.py"]
