#!/bin/bash
# Dev mode wrapper for PM2
export DATABASE_URL="postgresql://z@localhost:5432/staysuite"
cd /home/z/my-project
exec npx next dev -p 3000
