
'use strict';
const mongoose = require('mongoose');
const db = mongoose.connect(process.env.DB, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
});

const { Schema } = mongoose;

/*
data including text and delete_password. The saved database record will have at least the fields _id, text, created_on(date & time), bumped_on(date & time, starts same as created_on), reported (boolean), delete_password, & replies (array)

replies = [{text, created_on, delete_password, & reported}]
*/


const msgboardSchema = new Schema({
  board:  {type : String, require: true}, 
  text: {type : String},
  delete_passwd: {type : String, require: true},
  created_on : { type : Date, default : Date.now},
  bumped_on : { type : Date, default : Date.now},
  replies: [
    { text: String },
    { created_on: Date, default: Date.now},
    { delete_password: String},
    { reported: Boolean, default: false }
  ],
  reported: Boolean
});
const msgboard = mongoose.model('mesgboard', msgboardSchema);


async function findBoard(boardName, password='', msgtext='') {
  try {
    return await msgboard.findOne({ board: boardName, delete_passwd: password}).exec();
  } catch(err) { console.log("findOne ERROR: ",err); }
}

async function findById(id, boardName, password='', msgtext='') {
  try {
    return await msgboard.findById({_id: id, board: boardName}).exec();
  } catch(err) {console.log('findById error: ', err);}
}

async function findBoardByName(boardname) {
  try {
    return await msgboard.findOne({boardname}).exec();
  } catch(err) { console.log(err); }
}

async function createBoard(boardName, password, msgtext = '') {
  /* fetch board, if not found, create new one */
  const newBoard = new msgboard({
    board : boardName,
    delete_passwd : password,
    text : msgtext,
    created_on : new Date,
    bumped_on : new Date,
    replies : [],
    reported : false
  });
  try { 
    return await newBoard.save();
  } catch(err) { console.log(err); }
}

async function saveBoard(boardName, password, message) {
  let record = {};
  const foundBoard = await findBoard(boardName, password, message);
  // console.log("Found Board in dbase : ", foundBoard);
  if (!foundBoard) {
    try {
      const createNewMsgBoard = await createBoard(boardName, password, message);
      record = createNewMsgBoard;
      // console.log("Created new board data: ",record);
      return record;
    } catch(err) { console.log(err); }
  } else {
    return foundBoard;
  }
}




/* main driver */
module.exports = function (app) {

  app.route('/api/threads/:board')
    
    /* POST request to /api/threads/{board} */
    /*
data including text and delete_password. The saved database record will have at least the fields _id, text, created_on(date & time), bumped_on(date & time, starts same as created_on), reported (boolean), delete_password, & replies (array)
     */
    .post(async function (req, res){
        const { delete_password, text } = req.body;
        const brdname  = req.params.board;
        // console.log("POST threads Data ", brdname, delete_password, text);
        
        /* valid data? let's save */
        try {
          const aBoardData = await saveBoard(brdname, delete_password, text);
          res.json(aBoardData);
        } catch(err) { console.log(err); }
  
    })
  
    .get(async function (req, res) {
      let retArr = [];
      let boardname = req.params.board;
      
      //console.log('GET boardByName: ', req.params._id, boardname, passwd, text);

        try {
          const getBoard = await findBoardByName(boardname); 
          // console.log("GET boardByName: ", getBoard);
          retArr.push(getBoard);
          res.json(retArr);
        } catch (err) { console.log(err); }
      });    

/* REPLIES */
  app.route('/api/replies/:board')
/*
You can send a POST request to /api/replies/{board} with form data including text, delete_password, & thread_id. This will update the bumped_on date to the comment's date. In the thread's replies array, an object will be saved with at least the properties _id, text, created_on, delete_password, & reported.
*/
    .post(async function (req, res) {
      const { text, delete_password, thread_id } = req.body;
      const brdname  = req.params.board;
      // console.log('POST replies Data: -- %s -- %s', req.body, req.params.board);
      /* valid data? let's save */

      try {
        const aBoardData = await findById(thread_id, brdname, delete_password);
        if (aBoardData.delete_passwd = delete_password) {
          let found = false;
          aBoardData.replies.forEach(element => {
            if (element.text == text) {
              found = true;
              // console.log("Found match");
            }
          });
          if (!found) {
            /* new post, let's save it */
            /* text, created_on, delete_password, & reported */
              aBoardData.replies.push({"text":text,
                                      "created_on": Date.now,
                                      "delete_password": delete_password,
                                      "reported": true}); 
          }
          /* save aBoardData with replies[] */
          aBoardData.bumped_on = new Date;
          aBoardData.reported = true;
          // console.log("Replies -- FoundBoard: ", aBoardData);
          try { 
            await aBoardData.save();
          } catch(err) { console.log("==> Save Replies err: ", err); }
          
          res.json(aBoardData);
        }
      } catch(err) { console.log(err); }
    })
  
      /*
  Send a GET request to /api/replies/{board}?thread_id={thread_id}. Returned will be the entire thread with all its replies, also excluding the same fields from the client as the previous test.
  You can send a DELETE request to /api/threads/{board} and pass along the thread_id & delete_password to delete the thread. Returned will be the string incorrect password or success.
      */
    .get(async function (req, res){
      // console.log('>>>>>>  GET replies: ',req.params);
      try {
        let allBoards = await findBoardByName(req.params.board);

        res.json(allBoards);
      }catch(err) {console.log(err);}
    })
  
    /*
  You can send a DELETE request to /api/replies/{board} and pass along the thread_id, reply_id, & delete_password. Returned will be the string incorrect password or success. On success, the text of the reply_id will be changed to [deleted]. (Test timed out)
    */
    .delete(async function (req, res, next) {
      const { thread_id, reply_id, delete_password } = req.body;
      // console.log('DELETE ', thread_id, reply_id, delete_password + '\n');
      try {
        await msgboard.findAndUpdate({_id: thread_id, delete_passwd: delete_password, "replies": {_id : reply_id, text: 'deleted'}}).exec();
        
        res.json('success');

      } catch(err) { res.json("incorrect password"); }     
      
      
    })
};