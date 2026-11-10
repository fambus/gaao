-- pg_net was enabled during early testing and nothing uses it (no functions, triggers or queued requests).
drop extension if exists pg_net;
