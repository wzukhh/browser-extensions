package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestConversionSlotRejectsConcurrentJobAndReleasesAfterEnd(t *testing.T) {
	s := &Server{}

	if !s.beginConversion() {
		t.Fatal("first conversion should acquire the slot")
	}
	if s.beginConversion() {
		t.Fatal("second conversion should be rejected while one is active")
	}

	s.endConversion()

	if !s.beginConversion() {
		t.Fatal("conversion slot should be reusable after endConversion")
	}
}

func TestListWordFilesIncludesUppercaseExtensions(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"a.doc", "b.DOCX", "c.DOc", "skip.txt"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("x"), 0644); err != nil {
			t.Fatalf("write fixture %s: %v", name, err)
		}
	}

	files, err := listWordFiles(dir)
	if err != nil {
		t.Fatal(err)
	}

	got := map[string]bool{}
	for _, f := range files {
		got[f.Name] = true
	}
	for _, want := range []string{"a.doc", "b.DOCX", "c.DOc"} {
		if !got[want] {
			t.Fatalf("expected %s to be listed, got %#v", want, got)
		}
	}
	if got["skip.txt"] {
		t.Fatal("non-Word file should not be listed")
	}
}
