# Compile server

This is the sister project for [Remote-compile](https://github.com/mahdi-frms/remote-compile) in which you can read about the API and architecture of the whole project.

## Requirements

The compile server needs a `.env` file for the following configurations:

```
VERSION=                                # server version
PORT=                                   # http server port
DBNAME=                                 # database name
DBUSER=                                 # database username
DBPASS=                                 # database password
DBHOST=                                 # database host
MINIO_PORT=                             # minio
MINIO_ENDPOINT=                         # minio
MINIO_ACCESSKEY=                        # minio
MINIO_SECRETKEY=                        # minio
SERVER=                                 # core service endpoint
BUILD_POOL_SIZE=8                       # compiler pool size
RCS_SECRET=                             # secret used for communicating
```

## Running

cd to project directory and run:

```shell
npm install
npm start -- <server root directory>
```