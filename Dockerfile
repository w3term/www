FROM nginx:1.28

COPY . .

RUN ./build.sh && \
    mv terminal.html /usr/share/nginx/html/index.html && \
    rm index.css index.html index.js build.sh