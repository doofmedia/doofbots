VERSION=`cat version.txt`
DH_USERNAME=`echo elliotdiebold`
IMAGE_NAME=`echo behaimbot`

.PHONY: build
build:
	docker build -t $(DH_USERNAME)/$(IMAGE_NAME):version$(VERSION) .

.PHONY: push
push:
	docker push $(DH_USERNAME)/$(IMAGE_NAME):version$(VERSION)

.PHONY: run
run:
	docker run --restart=always -e DBPASS=${DBPASS} -e BOTPASS=${BOTPASS} -t $(DH_USERNAME)/$(IMAGE_NAME):version$(VERSION)

.PHONY: dev
dev:
	docker run --restart=always -e DOOFDEVMODE=true -e BOTPASS=${BOTPASS} -t $(DH_USERNAME)/$(IMAGE_NAME):version$(VERSION)