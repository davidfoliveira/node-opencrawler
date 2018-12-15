all: dep

dep:
	npm install . --only=production

clean:
	rm -rf node_modules

run:
	NODE_ENV=develop node bin/crawler.js

lint:
	npm run lint
