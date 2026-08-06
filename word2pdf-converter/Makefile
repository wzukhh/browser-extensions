.PHONY: build build-all build-dir install uninstall clean fmt

NAME    := word2pdf-converter
VERSION := 1.0.0

build:
	cd src && GOOS=windows GOARCH=amd64 go build -o $(NAME).exe .

build-all: build-dir
	cd src && GOOS=windows GOARCH=amd64 go build -o ../build/windows/$(NAME).exe .

build-dir:
	mkdir -p build/windows

install: build
	scripts/install.bat

uninstall:
	scripts/uninstall.bat

clean:
	rm -f src/$(NAME).exe
	rm -rf build/

fmt:
	cd src && go fmt ./...
