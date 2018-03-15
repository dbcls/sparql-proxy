# Dockerfile for https://github.com/dbcls/sparql-proxy
#
# Usage example:
#
# $ docker run -e PORT=3000 -e SPARQL_BACKEND=https://integbio.jp/rdf/ddbj/sparql -e ADMIN_USER=admin -e ADMIN_PASSWORD=password -e CACHE_STORE=file -e CACHE_STORE_PATH=/opt/cache -e COMPRESSOR=snappy -e MAX_LIMIT=10000 -e JOB_TIMEOUT=300000 -e MAX_CONCURRENCY=1 -d -p 80:3000 -t sparql-proxy 
#
# TODO: install and setup memcached and redis
#

FROM ubuntu:16.04

ARG node_version=v8.10.0

RUN apt-get -qq update && apt-get -qq install -y \
    pkg-config \
    sudo \
    curl \
    wget \
    git \
    jq \
    vim \
    python-dev

# memcached
# redis

WORKDIR /opt/src

RUN wget --no-check-certificate https://nodejs.org/dist/${node_version}/node-${node_version}-linux-x64.tar.xz
RUN tar xvf node-${node_version}-linux-x64.tar.xz

ENV PATH /opt/bin:$PATH

RUN ln -s /opt/src/node-${node_version}-linux-x64/bin /opt/bin
RUN npm install -g forever

WORKDIR /opt/git

RUN useradd -m sparql-proxy
RUN chown sparql-proxy /opt/git
USER sparql-proxy

RUN git clone https://github.com/dbcls/sparql-proxy.git

WORKDIR /opt/git/sparql-proxy

RUN npm install

CMD npm start
