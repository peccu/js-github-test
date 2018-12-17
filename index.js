import "babel-polyfill";
// Start out the normal way with a plain object.
var repo = {};

// This only works for normal repos.  Github doesn't allow access to gists as
// far as I can tell.
var githubName = "peccu/js-github-test";

// Your user can generate these manually at https://github.com/settings/tokens/new
// Or you can use an oauth flow to get a token for the user.
var githubToken = "57128603aa9fc2e10e283a565244e13d0790385b";

// Mixin the main library using github to provide the following:
// - repo.loadAs(type, hash) => value
// - repo.saveAs(type, value) => hash
// - repo.listRefs(filter='') => [ refs ]
// - repo.readRef(ref) => hash
// - repo.updateRef(ref, hash) => hash
// - repo.deleteRef(ref) => null
// - repo.createTree(entries) => hash
// - repo.hasHash(hash) => has
require('js-github/mixins/github-db')(repo, githubName, githubToken);

// Github has this built-in, but it's currently very buggy so we replace with
// the manual implementation in js-git.
require('js-git/mixins/create-tree')(repo);

// Cache github objects locally in indexeddb
var db = require('js-git/mixins/indexed-db')
    require('js-git/mixins/add-cache')(repo, db);

// Cache everything except blobs over 100 bytes in memory.
// This makes path-to-hash lookup a sync operation in most cases.
require('js-git/mixins/mem-cache')(repo);

// Combine concurrent read requests for the same hash
require('js-git/mixins/read-combiner')(repo);

// Add in value formatting niceties.  Also adds text and array types.
require('js-git/mixins/formats')(repo);

// Browser only: we need to initialize the indexeddb
db.init(function(err) {
	if (err) throw err;
    });


// I'm using generator syntax, but callback style also works.
// See js-git main docs for more details.
var run = require('gen-run');
run(function* () {
	var headHash = yield repo.readRef("refs/heads/master");
	var commit = yield repo.loadAs("commit", headHash);
	var tree = yield repo.loadAs("tree", commit.tree);
	var entry = tree["README.md"];
	var readme = yield repo.loadAs("text", entry.hash);

	// Build the updates array
  var updates = [
		 {
		     path: "README.md", // Update the existing entry
		     mode: entry.mode,  // Preserve the mode (it might have been executible)
		     content: readme.toUpperCase() // Write the new content
		 }
		 ];
  // Based on the existing tree, we only want to update, not replace.
  updates.base = commit.tree;

  // Create the new file and the updated tree.
  var treeHash = yield repo.createTree(updates);

  var commitHash = yield repo.saveAs("commit", {
	  tree: treeHash,
	  author: {
	      name: "peccu",
	      email: "peccul@gmail.com"
	  },
	  parent: headHash,
	  message: "Change README.md to be all uppercase using js-github"
      });

  // Now we can browse to this commit by hash, but it's still not in master.
  // We need to update the ref to point to this new commit.

  yield repo.updateRef("refs/heads/master", commitHash);
  console.log('success');
    });
