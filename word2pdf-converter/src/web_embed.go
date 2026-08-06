package main

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed web/index.html web/style.css web/app.js
var webFiles embed.FS

// webFileSystem returns an http.FileSystem rooted at the embedded web directory.
func webFileSystem() http.FileSystem {
	sub, err := fs.Sub(webFiles, "web")
	if err != nil {
		panic(err)
	}
	return http.FS(sub)
}

// webFileServer returns an http.Handler that serves the embedded web UI.
func webFileServer() http.Handler {
	return http.FileServer(webFileSystem())
}
