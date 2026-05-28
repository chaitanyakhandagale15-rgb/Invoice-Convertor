@echo off
set PGPASSWORD=manager
C:\Progra~1\PostgreSQL\18\bin\psql.exe -U postgres -c "SELECT version();"
