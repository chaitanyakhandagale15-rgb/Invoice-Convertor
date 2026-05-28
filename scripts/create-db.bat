@echo off
set PGPASSWORD=manager
C:\Progra~1\PostgreSQL\18\bin\createdb.exe -U postgres invoicebridge
echo Database created (or already exists)
