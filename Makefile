all: dep

dep:
	npm install . --only=production

clean:
	rm -rf node_modules
