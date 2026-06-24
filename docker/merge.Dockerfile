FROM alpine:3.21
RUN apk add --no-cache ffmpeg bash
COPY merge.sh /usr/local/bin/merge
RUN chmod +x /usr/local/bin/merge
ENTRYPOINT ["merge"]
