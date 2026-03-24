FROM postgres:16-alpine

# Install AWS CLI v2 (via pip — smallest footprint on Alpine)
RUN apk add --no-cache python3 py3-pip curl \
    && pip3 install --no-cache-dir awscli \
    && rm -rf /root/.cache

COPY pg_backup.sh /scripts/pg_backup.sh
COPY pg_restore.sh /scripts/pg_restore.sh
COPY wal_archive.sh /scripts/wal_archive.sh
COPY wal_restore.sh /scripts/wal_restore.sh

RUN chmod +x /scripts/*.sh

USER postgres
