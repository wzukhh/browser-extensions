.PHONY: all build build-all clean install release

# Build for current platform (output to build/ root for dev testing)
build:
	cd src && go build -ldflags="-s -w" -o ../build/lan-file-transfer .

# Build for all supported platforms
build-all:
	cd src && GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o ../build/windows/lan-file-transfer.exe .
	cd src && GOOS=darwin  GOARCH=arm64 go build -ldflags="-s -w" -o ../build/macos/lan-file-transfer .
	cd src && GOOS=darwin  GOARCH=amd64 go build -ldflags="-s -w" -o ../build/macos/lan-file-transfer-intel .
	cd src && GOOS=linux   GOARCH=amd64 go build -ldflags="-s -w" -o ../build/linux/lan-file-transfer .
	@echo ""
	@echo "  ✅ 所有平台编译完成"

# Install native host (macOS/Linux)
install:
	@./scripts/install.sh

# Uninstall native host (macOS/Linux)
uninstall:
	@./scripts/uninstall.sh

# Clean build artifacts (keep build/ dir structure, remove binaries)
clean:
	rm -f build/windows/lan-file-transfer.exe
	rm -f build/macos/lan-file-transfer build/macos/lan-file-transfer-intel
	rm -f build/linux/lan-file-transfer

# Create release archives
release: build-all
	@cd build && \
	zip -r lan-file-transfer-windows.zip windows/ && \
	zip -r lan-file-transfer-macos.zip macos/ && \
	zip -r lan-file-transfer-linux.zip linux/ && \
	echo "" && \
	echo "  ✅ 发行包已创建: build/lan-file-transfer-*.zip"
