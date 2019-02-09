const
  util = require('../lib/util');

(async function(){
  const outputs = await util.eachPromise([0,1,2,3,4,5,6,7,8,9], (item) => {
    console.log("Running", item);
    return util.promiseWait(1000+item*100).then(() => {
      console.log("Finished "+item);
      return item*10000
    });
  }, 2);
  console.log("All done: ", outputs);
})();
