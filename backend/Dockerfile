FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY ml ./ml
COPY database ./database

# Build-time training ensures model artifact exists in production container.
RUN python ml/train_model.py

EXPOSE 8000

CMD ["python", "-m", "backend.run_backend"]
