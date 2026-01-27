FROM ollama/ollama

# Install Python, pip, and basic utilities
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    netcat-openbsd \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements.txt and install dependencies
COPY requirements.txt /app/
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy application code
COPY app /app/app
RUN chmod +x /app/app/start.sh

# Pull the model during build
RUN ollama serve & \
    sleep 10 && \
    ollama pull llama3 && \
    ollama pull qwen3:8b && \
    pkill ollama

# Expose FastAPI port
EXPOSE 8080

# Run the startup script
ENTRYPOINT ["/app/app/start.sh"]
