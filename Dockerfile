FROM python:3.9-slim

WORKDIR /app

# Install dependencies first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Then copy the rest of the files
COPY . .

# Ensure the directory structure exists
RUN mkdir -p /app/templates /app/static/js

EXPOSE 8080

CMD ["flask", "run", "--host=0.0.0.0", "--port=8080"]