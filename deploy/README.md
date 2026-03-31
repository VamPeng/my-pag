# Deploy Notes

For single-device deployment on a LAN, start the packaged server with:

```bash
./scripts/run.sh
```

The script now binds the Spring Boot server to `0.0.0.0` by default so other
devices on the same LAN can reach it by this machine's IP address.

Optional environment variables:

- `MY_PAG_HOST`: bind address, default `0.0.0.0`
- `MY_PAG_PORT`: bind port, default `8080`
- `MY_PAG_DB_PATH`: SQLite path used by the server process

Typical access pattern:

```bash
http://<this-machine-lan-ip>:8080
```

If LAN access still fails after the service starts, check the host firewall and
confirm both devices are on the same network segment.
