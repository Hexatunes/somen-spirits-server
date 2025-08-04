const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const YOKAI_DATABASE = require('./Databases/YOKAI_DATABASE.js');
const ATTACK_DATABASE = require('./Databases/ATTACK_DATABASE.js');
const TECHNIQUE_DATABASE = require('./Databases/TECHNIQUE_DATABASE.js');
const SKILL_DATABASE = require('./Databases/SKILL_DATABASE.js');
const INSPIRIT_DATABASE = require('./Databases/INSPIRIT_DATABASE.js');
const SOULTIMATE_DATABASE = require('./Databases/SOULTIMATE_DATABASE.js');
const ITEM_DATABASE = require('./Databases/ITEM_DATABASE.js');
const BANNED_TERMS = require('./Databases/BANNED_TERMS.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins (or specify your GitHub Pages URL)
    methods: ["GET", "POST"]
  }
});

// Serve a simple homepage (optional)
app.get('/', (req, res) => {
  res.send('Somen Spirits Socket.IO Server is running!');
});
app.use(express.json()); // For parsing JSON bodies


// Store connected clients (optional, for better management)
const connectedClients = new Map();





// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Socket.IO connection handler
var matchmakingQueue = []

var battles = {

}

io.on('connection', (socket) => {


  console.log('A user connected:', socket.id);

  // Add the client to the connectedClients map
  connectedClients.set(socket.id, socket);




  // --- RANDOM MATCHMAKING --- 🆚
  socket.on('lfg', (sentUID, sentTeam, sentUsername) => {

    //Validate team
    sentTeam.splice(0, 1)
    var teamIsValid = validate_team(sentTeam)

    if (teamIsValid != "valid") {
      connectedClients.get(socket.id).emit("lfg_validity", teamIsValid)
    }

    connectedClients.get(socket.id).emit("lfg_validity", "valid")



    console.log("Adding ", socket.id, " to the queue...");

    //Add player to queue
    matchmakingQueue.push([socket.id, sentUID, sentUsername, sentTeam])

    if (matchmakingQueue.length >= 2) {

      //Notify players
      var playerOne = connectedClients.get(matchmakingQueue[0][0])
      var playerTwo = connectedClients.get(matchmakingQueue[1][0])

      var BATTLE_ID = Math.floor(Math.random() * 100000)
      playerOne.emit("lfg_found", { UID: matchmakingQueue[1][1], BATTLE_ID: BATTLE_ID, username: matchmakingQueue[1][2] })
      playerTwo.emit("lfg_found", { UID: matchmakingQueue[0][1], BATTLE_ID: BATTLE_ID, username: matchmakingQueue[0][2] })


      //Create new game instance
      battles["" + BATTLE_ID] = {
        "TURN_ORDER": [],
        "PLAYER_ONE": {
          "TEAM": matchmakingQueue[0][3],
          "UID": matchmakingQueue[0][1],
          "USERNAME": matchmakingQueue[0][2],
          "SOCKET_ID": 0,
          "PINNED": -1,
          "CHARGING_IDX": -1,
        },
        "PLAYER_TWO": {
          "TEAM": matchmakingQueue[1][3],
          "UID": matchmakingQueue[1][1],
          "USERNAME": matchmakingQueue[1][2],
          "SOCKET_ID": 0,
          "PINNED": -1,
          "CHARGING_IDX": -1,
        }


      }
      //Remove players from queue
      matchmakingQueue.shift()
      matchmakingQueue.shift()
    }
  });

  //Cancel matchmaking
  socket.on('cancel_lfg', (sentUID) => {
    for (var i = 0; i < matchmakingQueue.length; i++) {
      if (matchmakingQueue[i][1] == sentUID) {
        matchmakingQueue.splice(i, 1)
        break
      }
    }

    console.log(sentUID, " stopped matchmaking.")
  })

  //Determine conductor
  socket.on('determine_conductor', (sentUID, sentBATTLE_ID) => {
    connectedClients.set(socket.id, socket);
    var player = connectedClients.get(socket.id)

    var p1Conduct
    var p2Conduct

    var bInst = battles[sentBATTLE_ID]

    if ( !bInst ) {
      return
    }


    if (bInst["PLAYER_ONE"]["UID"] >= bInst["PLAYER_TWO"]["UID"]) {
      p1Conduct = true
      p2Conduct = false
    } else {
      p1Conduct = false
      p2Conduct = true
    }

    //Connect the socket.id to the UID, then give back the appropriate data
    if (sentUID == bInst["PLAYER_ONE"]["UID"]) {

      player.emit("is_conductor", { isConductor: p1Conduct })
    } else {
      player.emit("is_conductor", { isConductor: p2Conduct })
    }

  })


  // --- INITIALIZE BATTLE ---
  socket.on('initialize_battle', (sentUID, sentBATTLE_ID, isConductor) => {

    var bInst = battles[sentBATTLE_ID]


    var player = connectedClients.get(socket.id)
    
    //Append battle data
    for (var i = 0; i < bInst["PLAYER_ONE"]["TEAM"].length; i++) {
      var toAppend = bInst["PLAYER_ONE"]["TEAM"][i]["code"]

      bInst["PLAYER_ONE"]["TEAM"][i].displayName = YOKAI_DATABASE[toAppend]["displayName"]

      bInst["PLAYER_ONE"]["TEAM"][i].na = YOKAI_DATABASE[toAppend]["normalAttack"]
      bInst["PLAYER_ONE"]["TEAM"][i].tech = YOKAI_DATABASE[toAppend]["technique"]
      bInst["PLAYER_ONE"]["TEAM"][i].soult = YOKAI_DATABASE[toAppend]["soultimate"]
      bInst["PLAYER_ONE"]["TEAM"][i].insp = YOKAI_DATABASE[toAppend]["inspirit"]
      bInst["PLAYER_ONE"]["TEAM"][i].skill = YOKAI_DATABASE[toAppend]["skill"]

      bInst["PLAYER_ONE"]["TEAM"][i].skillData = 0

      bInst["PLAYER_ONE"]["TEAM"][i]["AP"] = 0

      bInst["PLAYER_ONE"]["TEAM"][i].down = false
      bInst["PLAYER_ONE"]["TEAM"][i].currentHP = 0
      bInst["PLAYER_ONE"]["TEAM"][i].soul = 100
      bInst["PLAYER_ONE"]["TEAM"][i].guard = 1
      bInst["PLAYER_ONE"]["TEAM"][i].currentInspirits = []
      bInst["PLAYER_ONE"]["TEAM"][i].charging = "none"

      bInst["PLAYER_ONE"]["TEAM"][i].loafing = false
      bInst["PLAYER_ONE"]["TEAM"][i].poked = false
      bInst["PLAYER_ONE"]["TEAM"][i].chargingType = "normal"

    }

    for (var i = 0; i < bInst["PLAYER_TWO"]["TEAM"].length; i++) {
      var toAppend = bInst["PLAYER_TWO"]["TEAM"][i]["code"]

      bInst["PLAYER_TWO"]["TEAM"][i].displayName = YOKAI_DATABASE[toAppend]["displayName"]

      bInst["PLAYER_TWO"]["TEAM"][i].na = YOKAI_DATABASE[toAppend]["normalAttack"]
      bInst["PLAYER_TWO"]["TEAM"][i].tech = YOKAI_DATABASE[toAppend]["technique"]
      bInst["PLAYER_TWO"]["TEAM"][i].soult = YOKAI_DATABASE[toAppend]["soultimate"]
      bInst["PLAYER_TWO"]["TEAM"][i].insp = YOKAI_DATABASE[toAppend]["inspirit"]
      bInst["PLAYER_TWO"]["TEAM"][i].skill = YOKAI_DATABASE[toAppend]["skill"]

      bInst["PLAYER_TWO"]["TEAM"][i].skillData = 0

      bInst["PLAYER_TWO"]["TEAM"][i]["AP"] = 0

      bInst["PLAYER_TWO"]["TEAM"][i].down = false
      bInst["PLAYER_TWO"]["TEAM"][i].currentHP = 0
      bInst["PLAYER_TWO"]["TEAM"][i].soul = 100
      bInst["PLAYER_TWO"]["TEAM"][i].guard = 1
      bInst["PLAYER_TWO"]["TEAM"][i].currentInspirits = []
      bInst["PLAYER_TWO"]["TEAM"][i].charging = "none"

      bInst["PLAYER_TWO"]["TEAM"][i].loafing = false
      bInst["PLAYER_TWO"]["TEAM"][i].poked = false
      bInst["PLAYER_TWO"]["TEAM"][i].chargingType = "normal"

    }

    

    for (var i = 0; i < bInst["PLAYER_ONE"]["TEAM"].length; i++) {
      bInst["PLAYER_ONE"]["TEAM"][i].currentHP = bInst["PLAYER_ONE"]["TEAM"][i].hp
    }

    for (var i = 0; i < bInst["PLAYER_TWO"]["TEAM"].length; i++) {
      bInst["PLAYER_TWO"]["TEAM"][i].currentHP = bInst["PLAYER_TWO"]["TEAM"][i].hp
    }

    //First turn AP random modding
    var p1Team = bInst["PLAYER_ONE"]["TEAM"]
    var p2Team = bInst["PLAYER_TWO"]["TEAM"]


    if (isConductor) {
      

      bInst["TURN_ORDER"] = [p1Team[0], p1Team[1], p1Team[2], p2Team[0], p2Team[1], p2Team[2]]

      for (var i = 0; i < 6; i++) {
        var randMod = Math.round((Math.random() * 0.1 + 0.5) * 100) / 100

        bInst["TURN_ORDER"][i]["AP"] = calcAP(bInst["TURN_ORDER"][i]["spd"], randMod)
      }
      bInst["TURN_ORDER"] = bInst["TURN_ORDER"].sort((a, b) => a["AP"] - b["AP"])


    }

    var overwrite

    var newTeam1
    var newTeam2



    //------------ Check for skills that activate when STARTING A BATTLE ------------
    for (var i = 0; i < p1Team.length; i++) {
      if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("battleStart") > -1) {
        var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["battleStart"](p1Team, p2Team, p1Team[i]["order"], 1, i)
        if (dataReturned != "skip") {
          newTeam1 = dataReturned[0]
          newTeam2 = dataReturned[1]
          overwrite = true
        }

      }
    }

    for (var i = 0; i < p2Team.length; i++) {
      if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("battleStart") > -1) {
        var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["battleStart"](p1Team, p2Team, p2Team[i]["order"], 2, i)
        if (dataReturned != "skip") {
          newTeam1 = dataReturned[0]
          newTeam2 = dataReturned[1]
          overwrite = true
        }


      }
    }
    //-----------------------------------------------------------------------------
    

    // --- HOUZZAT SOUL ---
    for (var i = 0; i < p1Team.length; i++) {
      for ( var x = 0; x < p1Team[i]["items"].length; x++ ) {
        if ( p1Team[i]["items"][x]["displayName"] == "Houzzat Soul") {
          var side1 = i - 1
          var side2 = i + 1

          if ( side1 == -1 ) {
            side1 = 5
          }
          if ( side2 == 6 ) {
            side2 = 0
          }

          p1Team[side1]["spr"] = p1Team[side1]["spr"] * 1.2
          p1Team[side2]["spr"] = p1Team[side2]["spr"] * 1.2
        }
      }
    }

    for (var i = 0; i < p2Team.length; i++) {
      for ( var x = 0; x < p2Team[i]["items"].length; x++ ) {
        if ( p2Team[i]["items"][x]["displayName"] == "Houzzat Soul") {
          var side1 = i - 1
          var side2 = i + 1

          if ( side1 == -1 ) {
            side1 = 5
          }
          if ( side2 == 6 ) {
            side2 = 0
          }

          p2Team[side1]["spr"] = p2Team[side1]["spr"] * 1.2
          p2Team[side2]["spr"] = p2Team[side2]["spr"] * 1.2
        }
      }
    }


    // --- RUBINYAN SOUL ---
    for (var i = 0; i < p1Team.length; i++) {
      for ( var x = 0; x < p1Team[i]["items"].length; x++ ) {
        if ( p1Team[i]["items"][x]["displayName"] == "Rubinyan Soul") {
          var side1 = i - 1
          var side2 = i + 1

          if ( side1 == -1 ) {
            side1 = 5
          }
          if ( side2 == 6 ) {
            side2 = 0
          }

          p1Team[side1]["str"] = p1Team[side1]["str"] * 1.2
          p1Team[side2]["str"] = p1Team[side2]["str"] * 1.2
        }
      }
    }

    for (var i = 0; i < p2Team.length; i++) {
      for ( var x = 0; x < p2Team[i]["items"].length; x++ ) {
        if ( p2Team[i]["items"][x]["displayName"] == "Rubinyan Soul") {
          var side1 = i - 1
          var side2 = i + 1

          if ( side1 == -1 ) {
            side1 = 5
          }
          if ( side2 == 6 ) {
            side2 = 0
          }

          p2Team[side1]["str"] = p2Team[side1]["str"] * 1.2
          p2Team[side2]["str"] = p2Team[side2]["str"] * 1.2
        }
      }
    }


    if (overwrite) {
      p1Team = newTeam1
      p2Team = newTeam2
    }


    // Apply stat items
    for ( var i = 0; i < 6; i++ ) {
      for ( var x = 0; x < p1Team[i]["items"].length; x++ ) {

        if ( ITEM_DATABASE[p1Team[i]["items"][x]["code"]]["type"] == "stat" ) {

          p1Team[i]["hp"] += ITEM_DATABASE[p1Team[i]["items"][x]["code"]]["hp"]
          p1Team[i]["str"] += ITEM_DATABASE[p1Team[i]["items"][x]["code"]]["str"]
          p1Team[i]["spr"] += ITEM_DATABASE[p1Team[i]["items"][x]["code"]]["spr"]
          p1Team[i]["def"] += ITEM_DATABASE[p1Team[i]["items"][x]["code"]]["def"]
          p1Team[i]["spd"] += ITEM_DATABASE[p1Team[i]["items"][x]["code"]]["spd"]

        } 

      }

    }

    for ( var i = 0; i < 6; i++ ) {

      for ( var x = 0; x < p2Team[i]["items"].length; x++ ) {

        if ( ITEM_DATABASE[p2Team[i]["items"][x]["code"]]["type"] == "stat" ) {

          p2Team[i]["hp"] += ITEM_DATABASE[p2Team[i]["items"][x]["code"]]["hp"]
          p2Team[i]["str"] += ITEM_DATABASE[p2Team[i]["items"][x]["code"]]["str"]
          p2Team[i]["spr"] += ITEM_DATABASE[p2Team[i]["items"][x]["code"]]["spr"]
          p2Team[i]["def"] += ITEM_DATABASE[p2Team[i]["items"][x]["code"]]["def"]
          p2Team[i]["spd"] += ITEM_DATABASE[p2Team[i]["items"][x]["code"]]["spd"]

        } 

      }

    }
    //----------------------------------



    //Connect the socket.id to the UID, then give back the appropriate data
    if (sentUID == bInst["PLAYER_ONE"]["UID"]) {
      bInst["PLAYER_ONE"]["SOCKET_ID"] = socket.id

      player.emit("initialize_data", { myTeam: bInst["PLAYER_ONE"]["TEAM"], otherTeam: bInst["PLAYER_TWO"]["TEAM"] })
    } else {
      bInst["PLAYER_TWO"]["SOCKET_ID"] = socket.id

      player.emit("initialize_data", { myTeam: bInst["PLAYER_TWO"]["TEAM"], otherTeam: bInst["PLAYER_ONE"]["TEAM"] })
    }


  });




  // -- NEXT TURN ---
  socket.on('next_turn', (sentBATTLE_ID) => {

    // --- SET UP ---
    var bInst = battles[sentBATTLE_ID]

    if ( !bInst ) {
      return
    }

    var turnOrder = bInst["TURN_ORDER"]
    var p1Team = bInst["PLAYER_ONE"]["TEAM"]
    var p2Team = bInst["PLAYER_TWO"]["TEAM"]
    var p1UID = bInst["PLAYER_ONE"]["UID"]
    var p2UID = bInst["PLAYER_TWO"]["UID"]

    var p1Skills = bInst["PLAYER_ONE"]["SKILLS_LIST"]
    var p2Skills = bInst["PLAYER_TWO"]["SKILLS_LIST"]

    var p1 = connectedClients.get(bInst["PLAYER_ONE"]["SOCKET_ID"])
    var p2 = connectedClients.get(bInst["PLAYER_TWO"]["SOCKET_ID"])

    if ( !p1 ) {
      if ( p2 ) {
        p2.emit("opponent_disconnected")
      }
      
      bInst = ""

      return
    }

    if ( !p2 ) {
      if ( p1 ) {
        p1.emit("opponent_disconnected")
      }
      
      bInst = ""

      return
    }


    //--------------Increase inspirit age counter and remove if past 5 turns---------------------
    for ( var i = 0; i < 6; i++ ) {
      for ( var x = p1Team[i]["currentInspirits"].length - 1; x >= 0 ; x-- ) {
        if ( p1Team[i]["currentInspirits"][x]["age"] <= 5 ) {
          p1Team[i]["currentInspirits"][x]["age"] += 1
        } else {
          switch ( p1Team[i]["currentInspirits"][x]["tag"][0] ) {
            case "strUp":

              p1Team[i]["str"] -= 50

            case "strDown":

              p1Team[i]["str"] += 50

            
            case "sprUp":

              p1Team[i]["spr"] -= 50

            
            case "sprDown":

              p1Team[i]["spr"] += 50

            
            case "defUp":

              p1Team[i]["def"] -= 50

            
            case "defDown":

              p1Team[i]["def"] += 50

            
            case "spdUp":

              p1Team[i]["spd"] -= 50

            
            case "spdDown":

              p1Team[i]["spd"] += 50

            
            case "allUp":

              p1Team[i]["str"] -= 50
              p1Team[i]["spr"] -= 50
              p1Team[i]["def"] -= 50
              p1Team[i]["spd"] -= 50

            
            case "allDown":

              p1Team[i]["str"] += 50
              p1Team[i]["spr"] += 50
              p1Team[i]["def"] += 50
              p1Team[i]["spd"] += 50
          }
          p1Team[i]["currentInspirits"].splice(x, 1)
        }
      }
    }

    //Increase inspirit age counter and remove if past 5 turns
    for ( var i = 0; i < 6; i++ ) {
      for ( var x = p2Team[i]["currentInspirits"].length - 1; x >= 0; x-- ) {
        if ( p2Team[i]["currentInspirits"][x]["age"] <= 5 ) {
          p2Team[i]["currentInspirits"][x]["age"] += 1
        } else {
          switch ( p2Team[i]["currentInspirits"][x]["tag"][0] ) {
            case "strUp":

              p2Team[i]["str"] -= 50

            case "strDown":

              p2Team[i]["str"] += 50

            
            case "sprUp":

              p2Team[i]["spr"] -= 50

            
            case "sprDown":

              p2Team[i]["spr"] += 50

            
            case "defUp":

              p2Team[i]["def"] -= 50

            
            case "defDown":

              p2Team[i]["def"] += 50

            
            case "spdUp":

              p2Team[i]["spd"] -= 50

            
            case "spdDown":

              p2Team[i]["spd"] += 50

            
            case "allUp":

              p2Team[i]["str"] -= 50
              p2Team[i]["spr"] -= 50
              p2Team[i]["def"] -= 50
              p2Team[i]["spd"] -= 50

            
            case "allDown":

              p2Team[i]["str"] += 50
              p2Team[i]["spr"] += 50
              p2Team[i]["def"] += 50
              p2Team[i]["spd"] += 50
          }
          p2Team[i]["currentInspirits"].splice(x, 1)
        }
      }
    }
    
    //-------------------------------------------------------------------------------------------


    //Decide what action to take this turn
    let decisions = {
      "attack": YOKAI_DATABASE[turnOrder[0]["code"]]["probAtk"],
      "technique": YOKAI_DATABASE[turnOrder[0]["code"]]["probTech"],
      "inspirit": YOKAI_DATABASE[turnOrder[0]["code"]]["probInsp"],
      "guard": YOKAI_DATABASE[turnOrder[0]["code"]]["probGuard"]
    };

    var choice = weightedRandom(decisions)

    

    var possibleChoices = []


    var targetSide = -1
    
    if (turnOrder[0]["UID"] == p1UID) {
      targetSide = 2
    } else {
      targetSide = 1
    }

    // --- Determine possible targets and who's acting ---
    if ( targetSide == 1 ) {

      for ( var i = 0; i < 3; i++ ) {

        var canAdd = true

        for ( var x = 0; x < p1Team[i]["items"].length; x++ ) {

          if ( p1Team[i]["items"][x]["displayName"] == "Stealth Soul" ) {
            canAdd = false
          }

        }

        if ( i == 0 ) {
          if ( p1Team[1]["currentHP"] <= 0 && p1Team[2]["currentHP"] <= 0 ) {
            canAdd = true
          }
        } else if ( i == 1) {
          if ( p1Team[0]["currentHP"] <= 0 && p1Team[2]["currentHP"] <= 0 ) {
            canAdd = true
          }
        } else {
          if ( p1Team[0]["currentHP"] <= 0 && p1Team[1]["currentHP"] <= 0 ) {
            canAdd = true
          }
        }

        if ( p1Team[i]["currentHP"] < 0 ) {
          canAdd = false
        }

        if ( canAdd ) {
          possibleChoices.push(i)
        }

      }

    } else {
      for ( var i = 0; i < 3; i++ ) {

        var canAdd = true

        for ( var x = 0; x < p2Team[i]["items"].length; x++ ) {

          if ( p2Team[i]["items"][x]["displayName"] == "Stealth Soul" ) {
            canAdd = false
          }

        }

        if ( i == 0 ) {
          if ( p2Team[1]["currentHP"] <= 0 && p2Team[2]["currentHP"] <= 0 ) {
            canAdd = true
          }
        } else if ( i == 1) {
          if ( p2Team[0]["currentHP"] <= 0 && p2Team[2]["currentHP"] <= 0 ) {
            canAdd = true
          }
        } else {
          if ( p2Team[0]["currentHP"] <= 0 && p2Team[1]["currentHP"] <= 0 ) {
            canAdd = true
          }
        }

        if ( p2Team[i]["currentHP"] < 0 ) {
          canAdd = false
        }

        if ( canAdd ) {
          possibleChoices.push(i)
        }

      }
    }


    // --- Check if the yokai is charging a soult, if so, skip turn ---
    if ( turnOrder[0]["charging"] == "chargING") {
      p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: turnOrder[0]["displayName"] + " is charging a soultimate. Skipping their turn."})
      p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: turnOrder[0]["displayName"] + " is charging a soultimate. Skipping their turn."})
      
      //Update turn order

      for (var i = turnOrder.length - 1; i >= 0; i--) {
        if (turnOrder[i]["currentHP"] <= 0) {
          turnOrder.splice(i, 1)
          i--
        }
      }

      for (var i = 1; i < turnOrder.length; i++) {
        turnOrder[i]["AP"] -= turnOrder[0]["AP"]
        if (turnOrder[i]["AP"] < 0) {
          turnOrder[i]["AP"] = 0
        }
      }



      bInst["TURN_ORDER"][0]["AP"] = calcAP(bInst["TURN_ORDER"][0]["spd"], 1)

      bInst["TURN_ORDER"] = bInst["TURN_ORDER"].sort((a, b) => a["AP"] - b["AP"])


      

      return
    }

    

    
    
    var targetIDX = possibleChoices[Math.floor(Math.random() * possibleChoices.length)] // NEEDS TO ACCOUNT FOR FAINTED YOKAI!


    // --- Check for pin target override ---
    if (turnOrder[0]["UID"] == p1UID) {
      if ( bInst["PLAYER_ONE"]["PINNED"] > -1) {
        targetIDX = bInst["PLAYER_ONE"]["PINNED"]
      }
    } else {
      if ( bInst["PLAYER_TWO"]["PINNED"] > -1) {
        targetIDX = bInst["PLAYER_TWO"]["PINNED"]
      }
    }

    // --- Check for various taunts ---
    if ( targetSide == 1 ) {

      for ( var i = 0; i < 3; i++ ) {
        for ( var x = 0; x < p1Team[i]["items"].length; x++ ) {

          if ( p1Team[i]["items"][x]["displayName"] == "Stinging Soul" ) {
            targetIDX = i
          }

        }
        for ( var x = 0; x < p1Team[i]["currentInspirits"].length; x++ ) {

          if ( p1Team[i]["currentInspirits"][x]["tag"][0] == "target" ) {
            targetIDX = i
          }

        }
      }

    } else {
      for ( var i = 0; i < 3; i++ ) {
        for ( var x = 0; x < p2Team[i]["items"].length; x++ ) {

          if ( p2Team[i]["items"][x]["displayName"] == "Stinging Soul" ) {
            targetIDX = i
          }

        }
        for ( var x = 0; x < p2Team[i]["currentInspirits"].length; x++ ) {

          if ( p2Team[i]["currentInspirits"][x]["tag"][0] == "target" ) {
            targetIDX = i
          }

        }
      }
    }

    // --- Check for inaction ---
    if ( targetSide == 1 ) {

      for ( var i = 0; i < 3; i++ ) {
        
        for ( var x = 0; x < p1Team[i]["currentInspirits"].length; x++ ) {

          var inactionRoll = Math.floor(Math.random() * 10)

          if ( p1Team[i]["currentInspirits"][x]["tag"][0] == "inaction" && inactionRoll == 0) {
            choice = "loaf"
          }

        }
      }

    } else {
      for ( var i = 0; i < 3; i++ ) {
        for ( var x = 0; x < p2Team[i]["currentInspirits"].length; x++ ) {

          var inactionRoll = Math.floor(Math.random() * 10)

          if ( p2Team[i]["currentInspirits"][x]["tag"][0] == "inaction" && inactionRoll == 0) {
            choice = "loaf"
          }

        }
      }
    }

    var finalDamage = 0

    var overwrite = false



    var loafRoll = Math.floor(Math.random() * 30)


    //------------ Check for skills that activate when CALCULATING LOAF ROLL ------------
    for (var i = 0; i < p1Team.length; i++) {
      if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("loafRoll") > -1) {
        var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["loafRoll"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p1Team[i]["order"], 1, i,)
        if (dataReturned != "skip") {
          loafRoll = dataReturned[0]
        }

      }
    }

    for (var i = 0; i < p2Team.length; i++) {
      if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("loafRoll") > -1) {
        var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["loafRoll"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p2Team[i]["order"], 2, i,)
        if (dataReturned != "skip") {
          loafRoll = dataReturned[0]
        }


      }
    }
    //-----------------------------------------------------------------------------

    if ( loafRoll == 0 ) {
      choice = "loaf"
    }

    var moxieBuff = 1

    // --- Force yokai to use soultimate if it's done charging ---
    if ( turnOrder[0]["charging"] == "chargED" ) {
      choice = "soultimate"
    }
    if ( turnOrder[0]["chargingType"] == "zero" ) {
      moxieBuff = 1.2
    }

    switch (choice) {

      case "attack":
        turnOrder[0]["guard"] = 1
        turnOrder[0]["loafing"] = false

        //Increase soultimate meter
        if (targetSide == 1) {
          for (var i = 0; i < p2Team.length; i++) {
            if (turnOrder[0]["order"] == p2Team[i]["order"]) {
              p2Team[i]["soul"] += 5
            }
          }
        } else {
          for (var i = 0; i < p1Team.length; i++) {
            if (turnOrder[0]["order"] == p1Team[i]["order"]) {
              p1Team[i]["soul"] += 5
            }
          }
        }

        var crits = 0
        var misses = 0

        var newTeam1
        var newTeam2

        //Calculate damage and factor for multi-hit attacks
        for (var i = 0; i < ATTACK_DATABASE[turnOrder[0]["na"]]["hits"]; i++) {


          var bp = ATTACK_DATABASE[turnOrder[0]["na"]]["bp"]
          var attribute = ATTACK_DATABASE[turnOrder[0]["na"]]["attribute"]

          var critRoll = Math.floor(Math.random() * 20)

          for ( var i = 0; i < turnOrder[0]["items"].length; i++ ) {
            if ( turnOrder[0]["items"][i]["displayName"] == "Devourer Soul" ) {
              critRoll = Math.floor(Math.random() * 15)
            }
          }

          //------------ Check for skills that activate when CALCULATING CRIT ROLL ------------
          for (var i = 0; i < p1Team.length; i++) {
            if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("naRollCrit") > -1) {
              var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["naRollCrit"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p1Team[i]["order"], 1, i)
              if (dataReturned != "skip") {
                critRoll = dataReturned[0]
              }

            }
          }

          for (var i = 0; i < p2Team.length; i++) {
            if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("naRollCrit") > -1) {
              var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["naRollCrit"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p2Team[i]["order"], 2, i)
              if (dataReturned != "skip") {
                critRoll = dataReturned[0]
              }


            }
          }
          //-----------------------------------------------------------------------------

          d1 = attack(p1Team, p2Team, targetSide, targetIDX, turnOrder, critRoll)

          crits += d1[1]


          var missOverwrite = false
          var missRoll = Math.floor(Math.random() * 20)

          //------------ Check for skills that activate when CALCULATING MISS ROLL ------------
          for (var i = 0; i < p1Team.length; i++) {
            if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("naRollAccuracy") > -1) {
              var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["naRollAccuracy"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p1Team[i]["order"], 1, i, crits)
              if (dataReturned != "skip") {
                missRoll = dataReturned[0]
              }

            }
          }

          for (var i = 0; i < p2Team.length; i++) {
            if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("naRollAccuracy") > -1) {
              var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["naRollAccuracy"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p2Team[i]["order"], 2, i, crits)
              if (dataReturned != "skip") {
                missRoll = dataReturned[0]
              }


            }
          }
          //-----------------------------------------------------------------------------

          if (missRoll == 0) {
              d1[0] = 0
              d1[2] = 1
          }

          
          finalDamage += d1[0]
          
          misses += d1[2]


        }

        



        //------------ Check for skills that activate when TAKING NA DAMAGE ------------
        for (var i = 0; i < p1Team.length; i++) {
          if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("naDamage") > -1) {
            var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["naDamage"](p1Team, p2Team, targetSide, targetIDX, turnOrder, finalDamage, p1Team[i]["order"], 1, i, crits)
            if (dataReturned != "skip") {
              newTeam1 = dataReturned[0]
              newTeam2 = dataReturned[1]
              overwrite = true
            }

          }
        }

        for (var i = 0; i < p2Team.length; i++) {
          if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("naDamage") > -1) {
            var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["naDamage"](p1Team, p2Team, targetSide, targetIDX, turnOrder, finalDamage, p2Team[i]["order"], 2, i, crits)
            if (dataReturned != "skip") {
              newTeam1 = dataReturned[0]
              newTeam2 = dataReturned[1]
              overwrite = true
            }


          }
        }
        //-----------------------------------------------------------------------------




        if (overwrite) {
          p1Team = newTeam1
          p2Team = newTeam2
        }

        // --- ROBO-F SOUL ---
        if ( targetSide == 1 ) {

          for ( var i = 0; i < 3; i++ ) {
            for ( var x = 0; x < p2Team[i]["items"].length; x++ ) {

              if ( p2Team[i]["items"][x]["displayName"] == "Robo-F Soul" && p2Team[i]["guard"] < 1) {
                turnOrder[0]["currentHP"] -= finalDamage * 1.5
                finalDamage = 0
              }

            }
          }

        } else {
          for ( var i = 0; i < 3; i++ ) {
            for ( var x = 0; x < p1Team[i]["items"].length; x++ ) {

              if ( p1Team[i]["items"][x]["displayName"] == "Robo-F Soul" && p1Team[i]["guard"] < 1) {
                turnOrder[0]["currentHP"] -= finalDamage * 1.5
                finalDamage = 0
              }

            }
          }
        }

        

        //Apply damage and advance turn
        if (targetSide == 1) {
          var has1HPSoul = false
          var hpSoulIDX = -1

          for ( var i = 0; i < p1Team[targetIDX]["items"].length; i++ ) {
            if ( p1Team[targetIDX]["items"][i]["displayName"] == "1HP Soul" && p1Team[targetIDX]["items"][i]["itemData"] == 0) {
              has1HPSoul = true
              hpSoulIDX = x
            }
          }

          if (!overwrite) {
            p1Team[targetIDX]["currentHP"] -= finalDamage
          }

          if ( p1Team[targetIDX]["currentHP"] <= 0 && has1HPSoul) {
            p1Team[targetIDX]["currentHP"] = 1
            p1Team[targetIDX]["items"][hpSoulIDX]["itemData"] = 1
          }


          p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'na'>" + ATTACK_DATABASE[turnOrder[0]["na"]]["displayName"] + "</em id = 'na'> on your " + p1Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p1Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses })
          p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'na'>" + ATTACK_DATABASE[turnOrder[0]["na"]]["displayName"] + "</em id = 'na'> on the opponent's " + p1Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p1Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'%)>", crits: crits, misses: misses })
        } else {

          if (!overwrite) {
            p2Team[targetIDX]["currentHP"] -= finalDamage
          }

          var has1HPSoul = false
          var hpSoulIDX = -1

          for ( var i = 0; i < p2Team[targetIDX]["items"].length; i++ ) {
            if ( p2Team[targetIDX]["items"][i]["displayName"] == "1HP Soul" && p2Team[targetIDX]["items"][i]["itemData"] == 0) {
              has1HPSoul = true
              hpSoulIDX = x
            }
          }

          if ( p2Team[targetIDX]["currentHP"] <= 0 && has1HPSoul) {
            p2Team[targetIDX]["currentHP"] = 1
            p2Team[targetIDX]["items"][hpSoulIDX]["itemData"] = 1
          }

          p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'na'>" + ATTACK_DATABASE[turnOrder[0]["na"]]["displayName"] + "</em id = 'na'> on the opponent's " + p2Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p2Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses })
          p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'na'>" + ATTACK_DATABASE[turnOrder[0]["na"]]["displayName"] + "</em id = 'na'> on your " + p2Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p2Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses })
        }

        break

        //_______________________________________________________________________________________________________________________________________________________________________________________________________________________________

      case "technique":
        turnOrder[0]["guard"] = 1
        turnOrder[0]["loafing"] = false

        //Increase soultimate meter
        if (targetSide == 1) {
          for (var i = 0; i < p2Team.length; i++) {
            if (turnOrder[0]["order"] == p2Team[i]["order"]) {
              p2Team[i]["soul"] += 5
            }
          }
        } else {
          for (var i = 0; i < p1Team.length; i++) {
            if (turnOrder[0]["order"] == p1Team[i]["order"]) {
              p1Team[i]["soul"] += 5
            }
          }
        }


        // DETERMINE TYPE OF TECHNIQUE (Heal, Drain, Normal)
        if (TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["type"] == "heal") {

          for (var i = 0; i < TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["hits"]; i++) {


            var bp = TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["bp"]
            var attribute = TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["attribute"]

            

            


            d1 = technique(p1Team, p2Team, targetSide, targetIDX, turnOrder)

            crits += d1[1]

            var missRoll = Math.floor(Math.random() * 20)

            if (missRoll == 0) {
                d1[0] = 0
                d1[2] = 1
            }


            finalDamage += d1[0]
            
            misses += d1[2]
          }

          var newTeam1
          var newTeam2



          //------------ Check for skills that activate when TAKING TECH DAMAGE ------------
          for (var i = 0; i < p1Team.length; i++) {
            if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("techDamage") > -1) {
              var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["techDamage"](p1Team, p2Team, targetSide, targetIDX, turnOrder, finalDamage, p1Team[i]["order"], 1, i, crits)
              if (dataReturned != "skip") {
                newTeam1 = dataReturned[0]
                newTeam2 = dataReturned[1]
                overwrite = true
              }

            }
          }

          for (var i = 0; i < p2Team.length; i++) {
            if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("techDamage") > -1) {
              var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["techDamage"](p1Team, p2Team, targetSide, targetIDX, turnOrder, finalDamage, p2Team[i]["order"], 2, i, crits)
              if (dataReturned != "skip") {
                newTeam1 = dataReturned[0]
                newTeam2 = dataReturned[1]
                overwrite = true
              }


            }
          }
          //-----------------------------------------------------------------------------




          if (overwrite) {
            p1Team = newTeam1
            p2Team = newTeam2
          }

          if (targetSide == 1) {
            if ( !overwrite ) {
              p2Team[targetIDX]["currentHP"] += finalDamage
            }
            

            p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'heal'>" + TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["displayName"] + "</em id = 'heal'> on their " + p2Team[targetIDX]["displayName"] + "! Heal: <em id = 'heal'>" + finalDamage + "</em id = 'heal'> (<em id = 'heal'>" + (Math.floor(finalDamage / p1Team[targetIDX]["hp"] * 100)) + "</em id = 'heal'>%)", crits: crits, misses: misses })
            p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'heal'>" + TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["displayName"] + "</em id = 'heal'> on your " + p2Team[targetIDX]["displayName"] + "! Heal: <em id = 'heal'>" + finalDamage + "</em id = 'heal'> (<em id = 'heal'>" + (Math.floor(finalDamage / p1Team[targetIDX]["hp"] * 100)) + "</em id = 'heal'>%)", crits: crits, misses: misses })
          } else {
            if ( !overwrite ) {
              p1Team[targetIDX]["currentHP"] += finalDamage
            }
            

            p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'heal'>" + TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["displayName"] + "</em id = 'heal'> on your " + p1Team[targetIDX]["displayName"] + "! Heal: <em id = 'heal'>" + finalDamage + "</em id = 'heal'> (<em id = 'heal'>" + (Math.floor(finalDamage / p2Team[targetIDX]["hp"] * 100)) + "</em id = 'heal'>%)", crits: crits, misses: misses })
            p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'heal'>" + TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["displayName"] + "</em id = 'heal'> on their " + p1Team[targetIDX]["displayName"] + "! Heal: <em id = 'heal'>" + finalDamage + "</em id = 'heal'> (<em id = 'heal'>" + (Math.floor(finalDamage / p2Team[targetIDX]["hp"] * 100)) + "</em id = 'heal'>%)", crits: crits, misses: misses })
          }

        } else if (TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["type"] == "drain") {

          for (var i = 0; i < TECHNIQUE_DATABASE[turnOrder[0].tech].hits; i++) {


            var bp = TECHNIQUE_DATABASE[turnOrder[0].tech].bp
            var attribute = TECHNIQUE_DATABASE[turnOrder[0].tech].attribute

            var critRoll = Math.floor(Math.random() * 20)

            for ( var i = 0; i < turnOrder[0]["items"].length; i++ ) {
              if ( turnOrder[0]["items"][i]["displayName"] == "Devourer Soul" ) {
                critRoll = Math.floor(Math.random() * 15)
              }
            }

            //------------ Check for skills that activate when CALCULATING CRIT ROLL ------------
            for (var i = 0; i < p1Team.length; i++) {
              if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("techRollCrit") > -1) {
                var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["techRollCrit"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p1Team[i]["order"], 1, i)
                if (dataReturned != "skip") {
                  critRoll = dataReturned[0]
                }

              }
            }

            for (var i = 0; i < p2Team.length; i++) {
              if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("techRollCrit") > -1) {
                var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["techRollCrit"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p2Team[i]["order"], 2, i)
                if (dataReturned != "skip") {
                  critRoll = dataReturned[0]
                }


              }
            }
            //-----------------------------------------------------------------------------


            d1 = technique(p1Team, p2Team, targetSide, targetIDX, turnOrder, critRoll)

            crits += d1[1]


            var missRoll = Math.floor(Math.random() * 20)

            //------------ Check for skills that activate when CALCULATING MISS ROLL ------------
            for (var i = 0; i < p1Team.length; i++) {
              if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("techRollAccuracy") > -1) {
                var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["techRollAccuracy"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p1Team[i]["order"], 1, i, crits)
                if (dataReturned != "skip") {
                  missRoll = dataReturned[0]
                }

              }
            }

            for (var i = 0; i < p2Team.length; i++) {
              if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("techRollAccuracy") > -1) {
                var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["techRollAccuracy"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p2Team[i]["order"], 2, i, crits)
                if (dataReturned != "skip") {
                  missRoll = dataReturned[0]
                }


              }
            }
            //-----------------------------------------------------------------------------


            if (missRoll == 0) {
                d1[0] = 0
                d1[2] = 1
            }


            finalDamage += d1[0]
            
            misses += d1[2]
          }

          var newTeam1
          var newTeam2



          //------------ Check for skills that activate when TAKING TECH DAMAGE ------------
          for (var i = 0; i < p1Team.length; i++) {
            if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("techDamage") > -1) {
              var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["techDamage"](p1Team, p2Team, targetSide, targetIDX, turnOrder, finalDamage, p1Team[i]["order"], 1, i)
              if (dataReturned != "skip") {
                newTeam1 = dataReturned[0]
                newTeam2 = dataReturned[1]
                overwrite = true
              }

            }
          }

          for (var i = 0; i < p2Team.length; i++) {
            if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("techDamage") > -1) {
              var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["techDamage"](p1Team, p2Team, targetSide, targetIDX, turnOrder, finalDamage, p2Team[i]["order"], 2, i)
              if (dataReturned != "skip") {
                newTeam1 = dataReturned[0]
                newTeam2 = dataReturned[1]
                overwrite = true
              }


            }
          }
          //-----------------------------------------------------------------------------




          if (overwrite) {
            p1Team = newTeam1
            p2Team = newTeam2
          }

          if (targetSide == 1) {
            if ( !overwrite ) {
              p1Team[targetIDX]["currentHP"] -= finalDamage
            }
            
            var has1HPSoul = false
            var hpSoulIDX = -1

            for ( var i = 0; i < p1Team[targetIDX]["items"].length; i++ ) {
              if ( p1Team[targetIDX]["items"][i]["displayName"] == "1HP Soul" && p1Team[targetIDX]["items"][i]["itemData"] == 0) {
                has1HPSoul = true
                hpSoulIDX = x
              }
            }

            if ( p1Team[targetIDX]["currentHP"] <= 0 && has1HPSoul) {
              p1Team[targetIDX]["currentHP"] = 1
              p1Team[targetIDX]["items"][hpSoulIDX]["itemData"] = 1
            }

            p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'drain'>" + TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["displayName"] + "</em id = 'drain'> on your " + p1Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p1Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses })
            p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'drain'>" + TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["displayName"] + "</em id = 'drain'> on the opponent's " + p1Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p1Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses })
          } else {

            if ( !overwrite ) {
              p2Team[targetIDX]["currentHP"] -= finalDamage
            }
            
            var has1HPSoul = false
            var hpSoulIDX = -1

            for ( var i = 0; i < p2Team[targetIDX]["items"].length; i++ ) {
              if ( p2Team[targetIDX]["items"][i]["displayName"] == "1HP Soul" && p2Team[targetIDX]["items"][i]["itemData"] == 0) {
                has1HPSoul = true
                hpSoulIDX = x
              }
            }

            if ( p2Team[targetIDX]["currentHP"] <= 0 && has1HPSoul) {
              p2Team[targetIDX]["currentHP"] = 1
              p2Team[targetIDX]["items"][hpSoulIDX]["itemData"] = 1
            }

            p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'drain'>" + TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["displayName"] + "</em id = 'drain'> on the opponent's " + p2Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p2Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses })
            p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'drain'>" + TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["displayName"] + "</em id = 'drain'> on your " + p2Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p2Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses })
          }

        } else {

          for (var i = 0; i < TECHNIQUE_DATABASE[turnOrder[0].tech].hits; i++) {


            var bp = TECHNIQUE_DATABASE[turnOrder[0].tech].bp
            var attribute = TECHNIQUE_DATABASE[turnOrder[0].tech].attribute

            var critRoll = Math.floor(Math.random() * 20)

            for ( var i = 0; i < turnOrder[0]["items"].length; i++ ) {
              if ( turnOrder[0]["items"][i]["displayName"] == "Devourer Soul" ) {
                critRoll = Math.floor(Math.random() * 15)
              }
            }

            //------------ Check for skills that activate when CALCULATING CRIT ROLL ------------
            for (var i = 0; i < p1Team.length; i++) {
              if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("techRollCrit") > -1) {
                var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["techRollCrit"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p1Team[i]["order"], 1, i)
                if (dataReturned != "skip") {
                  critRoll = dataReturned[0]
                }

              }
            }

            for (var i = 0; i < p2Team.length; i++) {
              if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("techRollCrit") > -1) {
                var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["techRollCrit"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p2Team[i]["order"], 2, i)
                if (dataReturned != "skip") {
                  critRoll = dataReturned[0]
                }


              }
            }
            //-----------------------------------------------------------------------------

            d1 = technique(p1Team, p2Team, targetSide, targetIDX, turnOrder, critRoll)

            crits += d1[1]

            var missRoll = Math.floor(Math.random() * 20)

            //------------ Check for skills that activate when CALCULATING MISS ROLL ------------
            for (var i = 0; i < p1Team.length; i++) {
              if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("techRollAccuracy") > -1) {
                var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["techRollAccuracy"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p1Team[i]["order"], 1, i, crits)
                if (dataReturned != "skip") {
                  missRoll = dataReturned[0]
                }

              }
            }

            for (var i = 0; i < p2Team.length; i++) {
              if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("techRollAccuracy") > -1) {
                var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["techRollAccuracy"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p2Team[i]["order"], 2, i, crits)
                if (dataReturned != "skip") {
                  missRoll = dataReturned[0]
                }


              }
            }
            //-----------------------------------------------------------------------------

            if ( !missOverwrite ) {
              missRoll
            }

            if (missRoll == 0) {
                d1[0] = 0
                d1[2] = 1
            }
            

            
            finalDamage += d1[0]
            
            misses += d1[2]

          }


          var newTeam1
          var newTeam2



          //------------ Check for skills that activate when TAKING TECH DAMAGE ------------
          for (var i = 0; i < p1Team.length; i++) {
            if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("techDamage") > -1) {
              var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["techDamage"](p1Team, p2Team, targetSide, targetIDX, turnOrder, finalDamage, p1Team[i]["order"], 1, i)
              if (dataReturned != "skip") {
                newTeam1 = dataReturned[0]
                newTeam2 = dataReturned[1]
                overwrite = true
              }

            }
          }

          for (var i = 0; i < p2Team.length; i++) {
            if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("techDamage") > -1) {
              var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["techDamage"](p1Team, p2Team, targetSide, targetIDX, turnOrder, finalDamage, p2Team[i]["order"], 2, i)
              if (dataReturned != "skip") {
                newTeam1 = dataReturned[0]
                newTeam2 = dataReturned[1]
                overwrite = true
              }


            }
          }
          //-----------------------------------------------------------------------------




          if (overwrite) {
            p1Team = newTeam1
            p2Team = newTeam2
          }


          if (targetSide == 1) {
            if ( !overwrite ) {
              p1Team[targetIDX]["currentHP"] -= finalDamage
            }
            
            var has1HPSoul = false
            var hpSoulIDX = -1

            for ( var i = 0; i < p1Team[targetIDX]["items"].length; i++ ) {
              if ( p1Team[targetIDX]["items"][i]["displayName"] == "1HP Soul" && p1Team[targetIDX]["items"][i]["itemData"] == 0) {
                has1HPSoul = true
                hpSoulIDX = x
              }
            }

            if ( p1Team[targetIDX]["currentHP"] <= 0 && has1HPSoul) {
              p1Team[targetIDX]["currentHP"] = 1
              p1Team[targetIDX]["items"][hpSoulIDX]["itemData"] = 1
            }

            p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'tech'>" + TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["displayName"] + "</em id = 'tech'> on your " + p1Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p1Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses })
            p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'tech'>" + TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["displayName"] + "</em id = 'tech'> on the opponent's " + p1Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p1Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses })
          } else {
            if ( !overwrite ) {
              p2Team[targetIDX]["currentHP"] -= finalDamage
            }
            
            var has1HPSoul = false
            var hpSoulIDX = -1

            for ( var i = 0; i < p2Team[targetIDX]["items"].length; i++ ) {
              if ( p2Team[targetIDX]["items"][i]["displayName"] == "1HP Soul" && p2Team[targetIDX]["items"][i]["itemData"] == 0) {
                has1HPSoul = true
                hpSoulIDX = x
              }
            }

            if ( p2Team[targetIDX]["currentHP"] <= 0 && has1HPSoul) {
              p2Team[targetIDX]["currentHP"] = 1
              p2Team[targetIDX]["items"][hpSoulIDX]["itemData"] = 1
            }

            p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'tech'>" + TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["displayName"] + "</em id = 'tech'> on the opponent's " + p2Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p2Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses })
            p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'tech'>" + TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["displayName"] + "</em id = 'tech'> on your " + p2Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p2Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses })
          }

        }


        break

        //_______________________________________________________________________________________________________________________________________________________________________________________________________________________________

      case "inspirit":
        turnOrder[0]["guard"] = 1
        turnOrder[0]["loafing"] = false

        //Increase soultimate meter
        if (targetSide == 1) {
          for (var i = 0; i < p2Team.length; i++) {
            if (turnOrder[0]["order"] == p2Team[i]["order"]) {
              p2Team[i]["soul"] += 5
            }
          }
        } else {
          for (var i = 0; i < p1Team.length; i++) {
            if (turnOrder[0]["order"] == p1Team[i]["order"]) {
              p1Team[i]["soul"] += 5
            }
          }
        }

        var d1 = inspirit(p1Team, p2Team, targetSide, targetIDX, turnOrder)

        if (d1[0] == "positive") {
          if (targetSide == 1) {
            p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " gave <em id = 'inspirit'>" + INSPIRIT_DATABASE[turnOrder[0]["insp"]]["displayName"] + "</em id = 'inspirit'> on their " + p2Team[targetIDX]["displayName"], crits: -1, misses: misses })
            p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " gave <em id = 'inspirit'>" + INSPIRIT_DATABASE[turnOrder[0]["insp"]]["displayName"] + "</em id = 'inspirit'> on your " + p2Team[targetIDX]["displayName"], crits: -1, misses: misses })
          } else {
            p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " gave <em id = 'inspirit'>" + INSPIRIT_DATABASE[turnOrder[0]["insp"]]["displayName"] + "</em id = 'inspirit'> on your " + p1Team[targetIDX]["displayName"], crits: -1, misses: misses })
            p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " gave <em id = 'inspirit'>" + INSPIRIT_DATABASE[turnOrder[0]["insp"]]["displayName"] + "</em id = 'inspirit'> on their " + p1Team[targetIDX]["displayName"], crits: -1, misses: misses })
          }

        } else {
          if (targetSide == 1) {
            p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " gave <em id = 'inspirit'>" + INSPIRIT_DATABASE[turnOrder[0]["insp"]]["displayName"] + "</em id = 'inspirit'> on your " + p1Team[targetIDX]["displayName"], crits: -1, misses: misses })
            p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " gave <em id = 'inspirit'>" + INSPIRIT_DATABASE[turnOrder[0]["insp"]]["displayName"] + "</em id = 'inspirit'> on the opponent's " + p1Team[targetIDX]["displayName"], crits: -1, misses: misses })
          } else {
            p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " gave <em id = 'inspirit'>" + INSPIRIT_DATABASE[turnOrder[0]["insp"]]["displayName"] + "</em id = 'inspirit'> on the opponent's " + p2Team[targetIDX]["displayName"], crits: -1, misses: misses })
            p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " gave <em id = 'inspirit'>" + INSPIRIT_DATABASE[turnOrder[0]["insp"]]["displayName"] + "</em id = 'inspirit'> on your " + p2Team[targetIDX]["displayName"], crits: -1, misses: misses })
          }
        }
        break

        //_______________________________________________________________________________________________________________________________________________________________________________________________________________________________

      case "soultimate":

        console.log(moxieBuff)

        turnOrder[0]["guard"] = 1
        turnOrder[0]["loafing"] = false

        if ( SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["targets"] == "allEnemies") {

          for (var x = 0; x < 3; x++){
            for (var i = 0; i < SOULTIMATE_DATABASE[turnOrder[0].soult].hits; i++) {


              var bp = SOULTIMATE_DATABASE[turnOrder[0].soult].bp
              var attribute = SOULTIMATE_DATABASE[turnOrder[0].soult].attribute

              //------------ Check for skills that activate when CALCULATING CRIT ROLL ------------
              for (var i = 0; i < p1Team.length; i++) {
                if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("soultRollCrit") > -1) {
                  var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["soultRollCrit"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p1Team[i]["order"], 1, i)
                  if (dataReturned != "skip") {
                    critRoll = dataReturned[0]
                  }

                }
              }

              for (var i = 0; i < p2Team.length; i++) {
                if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("soultRollCrit") > -1) {
                  var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["soultRollCrit"](p1Team, p2Team, targetSide, targetIDX, turnOrder, p2Team[i]["order"], 2, i)
                  if (dataReturned != "skip") {
                    critRoll = dataReturned[0]
                  }


                }
              }
              //-----------------------------------------------------------------------------
              
              d1 = soultimate(p1Team, p2Team, targetSide, x, turnOrder, critRoll, moxieBuff)
              finalDamage += d1[0]
              crits += d1[1]
              misses += d1[2]

            }

            if (targetSide == 1) {

              if ( SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["type"] == "heal") {
                p2Team[x]["currentHP"] += finalDamage

                var usingIDX = bInst["PLAYER_TWO"]["CHARGING_IDX"]
                var moxie1IDX = usingIDX - 1
                var moxie2IDX = usingIDX + 1


                if ( moxie1IDX == -1 ) {
                  moxie1IDX = 5
                }

                if ( moxie2IDX == 6 ) {
                  moxie2IDX = 0
                }
                
                p2Team[usingIDX]["charging"] = "none"
                p2Team[usingIDX]["soul"] = 0
                if ( moxieBuff > 1 ) {
                  p2Team[moxie1IDX]["soul"] = 0
                  p2Team[moxie2IDX]["soul"] = 0
                }

                p1.emit("soultimate_used", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on their " + p2Team[x]["displayName"] + "! Heal: <em id = 'heal'>" + finalDamage + "</em id = 'heal'> (<em id = 'heal'>" + (Math.floor(finalDamage / p2Team[x]["hp"] * 100)) + "</em id = 'heal'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
                p2.emit("soultimate_used", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on your " + p2Team[x]["displayName"] + "! Heal: <em id = 'heal'>" + finalDamage + "</em id = 'heal'> (<em id = 'heal'>" + (Math.floor(finalDamage / p2Team[x]["hp"] * 100)) + "</em id = 'heal'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
              } else {
                p1Team[x]["currentHP"] -= finalDamage

                var usingIDX = bInst["PLAYER_TWO"]["CHARGING_IDX"]
                var moxie1IDX = usingIDX - 1
                var moxie2IDX = usingIDX + 1


                if ( moxie1IDX == -1 ) {
                  moxie1IDX = 5
                }

                if ( moxie2IDX == 6 ) {
                  moxie2IDX = 0
                }
                
                p2Team[usingIDX]["charging"] = "none"
                p2Team[usingIDX]["soul"] = 0
                if ( moxieBuff > 1 ) {
                  p2Team[moxie1IDX]["soul"] = 0
                  p2Team[moxie2IDX]["soul"] = 0
                }

                p1.emit("soultimate_used", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on your " + p1Team[x]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p1Team[x]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
                p2.emit("soultimate_used", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on the opponent's " + p1Team[x]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p1Team[x]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
              }
              
              turnOrder[0]["charging"] = "none"
              turnOrder[0]["soul"] = 0

              
            } else {

              if ( SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["type"] == "heal") {
                p1Team[x]["currentHP"] += finalDamage

                var usingIDX = bInst["PLAYER_ONE"]["CHARGING_IDX"]
                var moxie1IDX = usingIDX - 1
                var moxie2IDX = usingIDX + 1


                if ( moxie1IDX == -1 ) {
                  moxie1IDX = 5
                }

                if ( moxie2IDX == 6 ) {
                  moxie2IDX = 0
                }
                
                p1Team[usingIDX]["charging"] = "none"
                p1Team[usingIDX]["soul"] = 0
                if ( moxieBuff > 1 ) {
                  p1Team[moxie1IDX]["soul"] = 0
                  p1Team[moxie2IDX]["soul"] = 0
                }

                p1.emit("soultimate_used", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on their " + p1Team[x]["displayName"] + "! Heal: <em id = 'heal'>" + finalDamage + "</em id = 'heal'> (<em id = 'heal'>" + (Math.floor(finalDamage / p1Team[x]["hp"] * 100)) + "</em id = 'heal'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
                p2.emit("soultimate_used", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on your " + p1Team[x]["displayName"] + "! Heal: <em id = 'heal'>" + finalDamage + "</em id = 'heal'> (<em id = 'heal'>" + (Math.floor(finalDamage / p1Team[x]["hp"] * 100)) + "</em id = 'heal'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
              } else {
                p2Team[x]["currentHP"] -= finalDamage

                var usingIDX = bInst["PLAYER_ONE"]["CHARGING_IDX"]
                var moxie1IDX = usingIDX - 1
                var moxie2IDX = usingIDX + 1


                if ( moxie1IDX == -1 ) {
                  moxie1IDX = 5
                }

                if ( moxie2IDX == 6 ) {
                  moxie2IDX = 0
                }
                
                p1Team[usingIDX]["charging"] = "none"
                
                p1Team[usingIDX]["soul"] = 0
                if ( moxieBuff > 1 ) {
                  p1Team[moxie1IDX]["soul"] = 0
                  p1Team[moxie2IDX]["soul"] = 0
                }
                

                p1.emit("soultimate_used", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on your " + p2Team[x]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p2Team[x]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
                p2.emit("soultimate_used", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on the opponent's " + p2Team[x]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p2Team[x]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
              }

              turnOrder[0]["charging"] = "none"
              turnOrder[0]["soul"] = 0
            }
          }
          
        } else {
          for (var i = 0; i < SOULTIMATE_DATABASE[turnOrder[0].soult].hits; i++) {


            var bp = SOULTIMATE_DATABASE[turnOrder[0].soult].bp
            var attribute = SOULTIMATE_DATABASE[turnOrder[0].soult].attribute

            d1 = soultimate(p1Team, p2Team, targetSide, targetIDX, turnOrder, critRoll, moxieBuff)
            finalDamage += d1[0]
            crits += d1[1]
            misses += d1[2]

          }

          if (targetSide == 1) {

            if ( SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["type"] == "heal") {
              p2Team[targetIDX]["currentHP"] += finalDamage

              var usingIDX = bInst["PLAYER_TWO"]["CHARGING_IDX"]
              var moxie1IDX = usingIDX - 1
                var moxie2IDX = usingIDX + 1


                if ( moxie1IDX == -1 ) {
                  moxie1IDX = 5
                }

                if ( moxie2IDX == 6 ) {
                  moxie2IDX = 0
                }
              
              p2Team[usingIDX]["charging"] = "none"
              p2Team[usingIDX]["soul"] = 0
                if ( moxieBuff > 1 ) {
                  p2Team[moxie1IDX]["soul"] = 0
                  p2Team[moxie2IDX]["soul"] = 0
                }

              p1.emit("soultimate_used", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on their " + p2Team[targetIDX]["displayName"] + "! Heal: <em id = 'heal'>" + finalDamage + "</em id = 'heal'> (<em id = 'heal'>" + (Math.floor(finalDamage / p2Team[targetIDX]["hp"] * 100)) + "</em id = 'heal'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
              p2.emit("soultimate_used", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on your " + p2Team[targetIDX]["displayName"] + "! Heal: <em id = 'heal'>" + finalDamage + "</em id = 'heal'> (<em id = 'heal'>" + (Math.floor(finalDamage / p2Team[targetIDX]["hp"] * 100)) + "</em id = 'heal'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
            } else {
              p1Team[targetIDX]["currentHP"] -= finalDamage

              var usingIDX = bInst["PLAYER_TWO"]["CHARGING_IDX"]
              var moxie1IDX = usingIDX - 1
                var moxie2IDX = usingIDX + 1


                if ( moxie1IDX == -1 ) {
                  moxie1IDX = 5
                }

                if ( moxie2IDX == 6 ) {
                  moxie2IDX = 0
                }
              
              p2Team[usingIDX]["charging"] = "none"
              p2Team[usingIDX]["soul"] = 0
              if ( moxieBuff > 1 ) {
                p2Team[moxie1IDX]["soul"] = 0
                p2Team[moxie2IDX]["soul"] = 0
              }

              p1.emit("soultimate_used", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on your " + p1Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p1Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
              p2.emit("soultimate_used", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on the opponent's " + p1Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p1Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
            }

            

            
          } else {

            if ( SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["type"] == "heal") {
              p1Team[targetIDX]["currentHP"] += finalDamage

              var usingIDX = bInst["PLAYER_ONE"]["CHARGING_IDX"]
              var moxie1IDX = usingIDX - 1
                var moxie2IDX = usingIDX + 1


                if ( moxie1IDX == -1 ) {
                  moxie1IDX = 5
                }

                if ( moxie2IDX == 6 ) {
                  moxie2IDX = 0
                }
              
              p1Team[usingIDX]["charging"] = "none"
              p1Team[usingIDX]["soul"] = 0
              if ( moxieBuff > 1 ) {
                p1Team[moxie1IDX]["soul"] = 0
                p1Team[moxie2IDX]["soul"] = 0
              }

              p1.emit("soultimate_used", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on their " + p1Team[targetIDX]["displayName"] + "! Heal: <em id = 'heal'>" + finalDamage + "</em id = 'heal'> (<em id = 'heal'>" + (Math.floor(finalDamage / p1Team[targetIDX]["hp"] * 100)) + "</em id = 'heal'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
              p2.emit("soultimate_used", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on your " + p1Team[targetIDX]["displayName"] + "! Heal: <em id = 'heal'>" + finalDamage + "</em id = 'heal'> (<em id = 'heal'>" + (Math.floor(finalDamage / p1Team[targetIDX]["hp"] * 100)) + "</em id = 'heal'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
            } else {
              p2Team[targetIDX]["currentHP"] -= finalDamage

              var usingIDX = bInst["PLAYER_ONE"]["CHARGING_IDX"]
              var moxie1IDX = usingIDX - 1
                var moxie2IDX = usingIDX + 1


                if ( moxie1IDX == -1 ) {
                  moxie1IDX = 5
                }

                if ( moxie2IDX == 6 ) {
                  moxie2IDX = 0
                }
              
              p1Team[usingIDX]["charging"] = "none"
              p1Team[usingIDX]["soul"] = 0
              if ( moxieBuff > 1 ) {
                p1Team[moxie1IDX]["soul"] = 0
                p1Team[moxie2IDX]["soul"] = 0
              }

              p1.emit("soultimate_used", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on your " + p2Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p2Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
              p2.emit("soultimate_used", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " used <em id = 'soult'>" + SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["displayName"] + "</em id = 'soult'> on the opponent's " + p2Team[targetIDX]["displayName"] + "! Damage: <em id = 'damage'>" + finalDamage + "</em id = 'damage'> (<em id = 'damage'>" + (Math.floor(finalDamage / p2Team[targetIDX]["hp"] * 100)) + "</em id = 'damage'>%)", crits: crits, misses: misses, soult: turnOrder[0]["soult"], moxieBuff: moxieBuff })
            }

            turnOrder[0]["charging"] = "none"
            turnOrder[0]["soul"] = 0
          }
        }

        
        break
      
        //_______________________________________________________________________________________________________________________________________________________________________________________________________________________________

      case "guard":

        turnOrder[0]["guard"] = 0.5
        turnOrder[0]["loafing"] = false

        if (targetSide == 1) {
          p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " started <em id = 'guard'> guarding", crits: -1, misses: misses })
          p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " started <em id = 'guard'> guarding", crits: -1, misses: misses })
        } else {
          p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " started <em id = 'guard'> guarding", crits: -1, misses: misses })
          p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " started <em id = 'guard'> guarding", crits: -1, misses: misses })
        }

        break

        //_______________________________________________________________________________________________________________________________________________________________________________________________________________________________
      
        case "loaf":

          turnOrder[0]["guard"] = 1
          turnOrder[0]["loafing"] = true

          if (targetSide == 1) {
            p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " started <em id = 'loaf'> loafing...", crits: -1, misses: misses })
            p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " started <em id = 'loaf'> loafing...", crits: -1, misses: misses })
          } else {
            p1.emit("turn_advanced", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "Your " + turnOrder[0]["displayName"] + " started <em id = 'loaf'> loafing...", crits: -1, misses: misses })
            p2.emit("turn_advanced", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "Opponent's " + turnOrder[0]["displayName"] + " started <em id = 'loaf'> loafing...", crits: -1, misses: misses })
          }

        //_______________________________________________________________________________________________________________________________________________________________________________________________________________________________
    }

    // Check if either player should win/lose
    if (p1Team[0]["currentHP"] <= 0 && p1Team[1]["currentHP"] <= 0 && p1Team[2]["currentHP"] <= 0 && p1Team[3]["currentHP"] <= 0 && p1Team[4]["currentHP"] <= 0 && p1Team[5]["currentHP"] <= 0) {
      p1.emit("defeat")
      p2.emit("victory")

      battles[sentBATTLE_ID] = ""
      return
    }

    if (p2Team[0]["currentHP"] <= 0 && p2Team[1]["currentHP"] <= 0 && p2Team[2]["currentHP"] <= 0 && p2Team[3]["currentHP"] <= 0 && p2Team[4]["currentHP"] <= 0 && p2Team[5]["currentHP"] <= 0) {
      p1.emit("victory")
      p2.emit("defeat")

      battles[sentBATTLE_ID] = ""
      return
    }

    //Check if the front yokai are all down and force a switch
    if (p1Team[0]["currentHP"] <= 0 && p1Team[1]["currentHP"] <= 0 && p1Team[2]["currentHP"] <= 0) {
      for (var i = 0; i < 3; i++){
          bInst["PLAYER_ONE"]["TEAM"].push(bInst["PLAYER_ONE"]["TEAM"].shift())
      }
      bInst["TURN_ORDER"] = [p1Team[0], p1Team[1], p1Team[2], p2Team[0], p2Team[1], p2Team[2]]

      p1.emit("front_fainted", { myTeam: battles[sentBATTLE_ID]["PLAYER_ONE"]["TEAM"], otherTeam: battles[sentBATTLE_ID]["PLAYER_TWO"]["TEAM"], downUID: bInst["PLAYER_ONE"]["UID"] })
      p2.emit("front_fainted", { myTeam: battles[sentBATTLE_ID]["PLAYER_TWO"]["TEAM"], otherTeam: battles[sentBATTLE_ID]["PLAYER_ONE"]["TEAM"], downUID: bInst["PLAYER_ONE"]["UID"] })
    }

    if (p2Team[0]["currentHP"] <= 0 && p2Team[1]["currentHP"] <= 0 && p2Team[2]["currentHP"] <= 0) {
      for (var i = 0; i < 3; i++){
        bInst["PLAYER_TWO"]["TEAM"].push(bInst["PLAYER_TWO"]["TEAM"].shift())
      }
      bInst["TURN_ORDER"] = [p1Team[0], p1Team[1], p1Team[2], p2Team[0], p2Team[1], p2Team[2]]

      p1.emit("front_fainted", { myTeam: battles[sentBATTLE_ID]["PLAYER_ONE"]["TEAM"], otherTeam: battles[sentBATTLE_ID]["PLAYER_TWO"]["TEAM"], downUID: bInst["PLAYER_TWO"]["UID"] })
      p2.emit("front_fainted", { myTeam: battles[sentBATTLE_ID]["PLAYER_TWO"]["TEAM"], otherTeam: battles[sentBATTLE_ID]["PLAYER_ONE"]["TEAM"], downUID: bInst["PLAYER_TWO"]["UID"] })
    }


    var overwrite2 = false
    
    //------------ Check for skills that activate when THE TURN ENDS ------------
    for (var i = 0; i < p1Team.length; i++) {
      if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("turnEnd") > -1) {
        var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["turnEnd"](p1Team, p2Team, turnOrder, p1Team[i]["order"], 1, i)
        if (dataReturned != "skip") {
          newTeam1 = dataReturned[0]
          newTeam2 = dataReturned[1]
          overwrite2 = true
        }

      }
    }

    for (var i = 0; i < p2Team.length; i++) {
      if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("turnEnd") > -1) {
        var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["turnEnd"](p1Team, p2Team, turnOrder, p2Team[i]["order"], 2, i)
        if (dataReturned != "skip") {
          newTeam1 = dataReturned[0]
          newTeam2 = dataReturned[1]
          overwrite2 = true
        }


      }
    }
    //-----------------------------------------------------------------------------

    



    if (overwrite || overwrite2) {
      p1Team = newTeam1
      p2Team = newTeam2
    }
    
    // --- AHS ---
    if ( targetSide == 1 ) {

      for ( var i = 0; i < 3; i++ ) {
        for ( var x = 0; x < p2Team[i]["items"].length; x++ ) {

          if ( p2Team[i]["items"][x]["displayName"] == "Adjacent Healing Soul" ) {
            if ( i == 0 ) {
      
              p2Team[1]["currentHP"] += p2Team[1]["hp"] * 0.02
              if ( p2Team[1]["currentHP"] > p2Team[1]["hp"] ) {
                p2Team[1]["currentHP"] = p2Team[1]["hp"]
              }

              p2Team[2]["currentHP"] += p2Team[2]["hp"] * 0.02
              if ( p2Team[2]["currentHP"] > p2Team[2]["hp"] ) {
                p2Team[2]["currentHP"] = p2Team[2]["hp"]
              }
            
            } else if ( i == 1 ) {

              p2Team[0]["currentHP"] += p2Team[0]["hp"] * 0.02
              if ( p2Team[0]["currentHP"] > p2Team[0]["hp"] ) {
                p2Team[0]["currentHP"] = p2Team[0]["hp"]
              }

              p2Team[2]["currentHP"] += p2Team[2]["hp"] * 0.02
              if ( p2Team[2]["currentHP"] > p2Team[2]["hp"] ) {
                p2Team[2]["currentHP"] = p2Team[2]["hp"]
              }

            } else if ( i == 2  ) {

              p2Team[0]["currentHP"] += p2Team[0]["hp"] * 0.02
              if ( p2Team[0]["currentHP"] > p2Team[0]["hp"] ) {
                p2Team[0]["currentHP"] = p2Team[0]["hp"]
              }

              p2Team[1]["currentHP"] += p2Team[1]["hp"] * 0.02
              if ( p2Team[1]["currentHP"] > p2Team[1]["hp"] ) {
                p2Team[1]["currentHP"] = p2Team[1]["hp"]
              }
            
            }
          }

        }
      }

    } else {
      for ( var i = 0; i < 3; i++ ) {
        for ( var x = 0; x < p1Team[i]["items"].length; x++ ) {

          if ( p1Team[i]["items"][x]["displayName"] == "Adjacent Healing Soul" ) {
            if ( i == 0 ) {
      
              p1Team[1]["currentHP"] += p1Team[1]["hp"] * 0.02
              if ( p1Team[1]["currentHP"] > p1Team[1]["hp"] ) {
                p1Team[1]["currentHP"] = p1Team[1]["hp"]
              }

              p1Team[2]["currentHP"] += p1Team[2]["hp"] * 0.02
              if ( p1Team[2]["currentHP"] > p1Team[2]["hp"] ) {
                p1Team[2]["currentHP"] = p1Team[2]["hp"]
              }
            
            } else if ( i == 1 ) {

              p1Team[0]["currentHP"] += p1Team[0]["hp"] * 0.02
              if ( p1Team[0]["currentHP"] > p1Team[0]["hp"] ) {
                p1Team[0]["currentHP"] = p1Team[0]["hp"]
              }

              p1Team[2]["currentHP"] += p1Team[2]["hp"] * 0.02
              if ( p1Team[2]["currentHP"] > p1Team[2]["hp"] ) {
                p1Team[2]["currentHP"] = p1Team[2]["hp"]
              }

            } else if ( i == 2  ) {

              p1Team[0]["currentHP"] += p1Team[0]["hp"] * 0.02
              if ( p1Team[0]["currentHP"] > p1Team[0]["hp"] ) {
                p1Team[0]["currentHP"] = p1Team[0]["hp"]
              }

              p1Team[1]["currentHP"] += p1Team[1]["hp"] * 0.02
              if ( p1Team[1]["currentHP"] > p1Team[1]["hp"] ) {
                p1Team[1]["currentHP"] = p1Team[1]["hp"]
              }
            
            }
          }

        }
      }
    }

    // --- Smogmella Soul ---
    if ( targetSide == 1 ) {

      for ( var i = 0; i < 3; i++ ) {
        for ( var x = 0; x < p2Team[i]["items"].length; x++ ) {

          if ( p2Team[i]["items"][x]["displayName"] == "Smogmella Soul" ) {
            if ( i == 0 ) {
      
              p2Team[1]["soul"] += 2
              if ( p2Team[1]["soul"] > 100 ) {
                p2Team[1]["soul"] = 100
              }

              p2Team[2]["soul"] += 2
              if ( p2Team[2]["soul"] > 100 ) {
                p2Team[2]["soul"] = 100
              }
            
            } else if ( i == 1 ) {

              p2Team[0]["soul"] += 2
              if ( p2Team[0]["soul"] > 100 ) {
                p2Team[0]["soul"] = 100
              }

              p2Team[2]["soul"] += 2
              if ( p2Team[2]["soul"] > 100 ) {
                p2Team[2]["soul"] = 100
              }

            } else if ( i == 2  ) {

              p2Team[0]["soul"] += 2
              if ( p2Team[0]["soul"] > 100 ) {
                p2Team[0]["soul"] = 100
              }

              p2Team[1]["soul"] += 2
              if ( p2Team[1]["soul"] > 100 ) {
                p2Team[1]["soul"] = 100
              }
            
            }
          }

        }
      }

    } else {
      for ( var i = 0; i < 3; i++ ) {
        for ( var x = 0; x < p1Team[i]["items"].length; x++ ) {

          if ( p1Team[i]["items"][x]["displayName"] == "Smogmella Soul" ) {
            if ( i == 0 ) {
      
              p1Team[1]["currentHP"] += 2
              if ( p1Team[1]["currentHP"] > 100 ) {
                p1Team[1]["currentHP"] = 100
              }

              p1Team[2]["currentHP"] += 2
              if ( p1Team[2]["currentHP"] > 100 ) {
                p1Team[2]["currentHP"] = 100
              }
            
            } else if ( i == 1 ) {

              p1Team[0]["currentHP"] += 2
              if ( p1Team[0]["currentHP"] > 100 ) {
                p1Team[0]["currentHP"] = 100
              }

              p1Team[2]["currentHP"] += 2
              if ( p1Team[2]["currentHP"] > 100 ) {
                p1Team[2]["currentHP"] = 100
              }

            } else if ( i == 2  ) {

              p1Team[0]["currentHP"] += 2
              if ( p1Team[0]["currentHP"] > 100 ) {
                p1Team[0]["currentHP"] = 100
              }

              p1Team[1]["currentHP"] += 2
              if ( p1Team[1]["currentHP"] > 100 ) {
                p1Team[1]["currentHP"] = 100
              }
            
            }
          }

        }
      }
    }
    
    //Update turn order

    for (var i = turnOrder.length - 1; i >= 0; i--) {
      if (turnOrder[i]["currentHP"] <= 0) {
        turnOrder.splice(i, 1)
        i--
      }
    }

    for (var i = 1; i < turnOrder.length; i++) {
      turnOrder[i]["AP"] -= turnOrder[0]["AP"]
      if (turnOrder[i]["AP"] < 0) {
        turnOrder[i]["AP"] = 0
      }
    }



    bInst["TURN_ORDER"][0]["AP"] = calcAP(bInst["TURN_ORDER"][0]["spd"], 1)

    bInst["TURN_ORDER"] = bInst["TURN_ORDER"].sort((a, b) => a["AP"] - b["AP"])
    
  });



  // -- ROTATE WHEEL ---
  socket.on('rotate_wheel', (sentBATTLE_ID, sentUID, sentRotation) => {


    var bInst = battles[sentBATTLE_ID]

    if ( !bInst ) {
      return
    }

    var p1Team = bInst["PLAYER_ONE"]["TEAM"]
    var p2Team = bInst["PLAYER_TWO"]["TEAM"]

    var p1 = connectedClients.get(bInst["PLAYER_ONE"]["SOCKET_ID"])
    var p2 = connectedClients.get(bInst["PLAYER_TWO"]["SOCKET_ID"])
    
    var turnOrder = bInst["TURN_ORDER"]

    var overwrite = false



    if (sentUID == bInst["PLAYER_ONE"]["UID"]) {
      // --- SHIELDING SOUL ---
      for ( var i = 0; i < 6; i++ ) {
        for ( var x = 0; x < p1Team[i]["items"].length; x++ ) {

          if ( p1Team[i]["items"][x]["displayName"] == "Shielding Soul" ) {
            
            if ( ((i + sentRotation > 2 && i + sentRotation < 6) || (i + sentRotation < 0 && i + sentRotation > -3)) ) {
              
              p1Team[i]["items"][x]["itemData"] = 0

            }

            if ( ((i + sentRotation > 5 && i + sentRotation < 9) || (i + sentRotation < 3 && i + sentRotation > -1)) && p1Team[i]["items"][x]["itemData"] == 0 ) {
              p1Team[i]["guard"] = 0.5
              p1Team[i]["items"][x]["itemData"] = 1

            }
          }

        }
      }

      //------------ Check for skills that activate ROTATING THE WHEEL ------------
      for (var i = 0; i < p1Team.length; i++) {
        if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("rotatedWheel") > -1) {
          var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["rotatedWheel"](p1Team, p2Team, turnOrder, p1Team[i]["order"], 1, i, 1, sentRotation)
          if (dataReturned != "skip") {
            newTeam1 = dataReturned[0]
            newTeam2 = dataReturned[1]
            overwrite = true
          }

        }
      }

      for (var i = 0; i < p2Team.length; i++) {
        if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("rotatedWheel") > -1) {
          var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["rotatedWheel"](p1Team, p2Team, turnOrder, p2Team[i]["order"], 2, i, 1, sentRotation)
          if (dataReturned != "skip") {
            newTeam1 = dataReturned[0]
            newTeam2 = dataReturned[1]
            overwrite = true
          }


        }
      }
      //-----------------------------------------------------------------------------

      

      if ( overwrite ) {
        bInst["PLAYER_ONE"]["TEAM"] = newTeam1
        bInst["PLAYER_TWO"]["TEAM"] = newTeam2
      }

      if ( sentRotation < 0 ) {
        for (var i = 0; i < Math.abs(sentRotation); i++){
          bInst["PLAYER_ONE"]["TEAM"].push(bInst["PLAYER_ONE"]["TEAM"].shift())
        }
      } else {
        for (var i = 0; i < Math.abs(sentRotation); i++){
          bInst["PLAYER_ONE"]["TEAM"].unshift(bInst["PLAYER_ONE"]["TEAM"].pop())
        }
      }

      // --- SPEED SOUL ---
      for ( var i = 0; i < 3; i++ ) {
        for ( var x = 0; x < p1Team[i]["items"].length; x++ ) {

          if ( p1Team[i]["items"][x]["displayName"] == "Speed Soul" ) {
            p1Team[i]["AP"] = 0
          }

        }
      }
      

      p1.emit("update_teams", {myTeam : p1Team, otherTeam : p2Team})
      p2.emit("update_teams", {myTeam : p2Team, otherTeam : p1Team})
    } else {
      // --- SHIELDING SOUL ---
      for ( var i = 0; i < 6; i++ ) {
        for ( var x = 0; x < p2Team[i]["items"].length; x++ ) {

          if ( p2Team[i]["items"][x]["displayName"] == "Shielding Soul" ) {
            
            if ( ((i + sentRotation > 2 && i + sentRotation < 6) || (i + sentRotation < 0 && i + sentRotation > -3)) ) {
              
              p2Team[i]["items"][x]["itemData"] = 0

            }

            if ( ((i + sentRotation > 5 && i + sentRotation < 9) || (i + sentRotation < 3 && i + sentRotation > -1)) && p2Team[i]["items"][x]["itemData"] == 0 ) {
              p2Team[i]["guard"] = 0.5
              p2Team[i]["items"][x]["itemData"] = 1

            }
          }

        }
      }
      

      //------------ Check for skills that activate ROTATING THE WHEEL ------------
      for (var i = 0; i < p1Team.length; i++) {
        if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("rotatedWheel") > -1) {
          var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["rotatedWheel"](p1Team, p2Team, turnOrder, p1Team[i]["order"], 1, i, 2, sentRotation)
          if (dataReturned != "skip") {
            newTeam1 = dataReturned[0]
            newTeam2 = dataReturned[1]
            overwrite = true
          }

        }
      }

      for (var i = 0; i < p2Team.length; i++) {
        if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("rotatedWheel") > -1) {
          var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["rotatedWheel"](p1Team, p2Team, turnOrder, p2Team[i]["order"], 2, i, 2, sentRotation)
          if (dataReturned != "skip") {
            newTeam1 = dataReturned[0]
            newTeam2 = dataReturned[1]
            overwrite = true
          }


        }
      }
      //-----------------------------------------------------------------------------

      if ( sentRotation < 0 ) {
        for (var i = 0; i < Math.abs(sentRotation); i++){
          bInst["PLAYER_TWO"]["TEAM"].push(bInst["PLAYER_TWO"]["TEAM"].shift())
        }
      } else {
        for (var i = 0; i < Math.abs(sentRotation); i++){
          bInst["PLAYER_TWO"]["TEAM"].unshift(bInst["PLAYER_TWO"]["TEAM"].pop())
        }
      }

      // --- SPEED SOUL --- 
      for ( var i = 0; i < 3; i++ ) {
        for ( var x = 0; x < p2Team[i]["items"].length; x++ ) {

          if ( p2Team[i]["items"][x]["displayName"] == "Speed Soul" ) {
            p2Team[i]["AP"] = 0
          }

        }
      }

      p1.emit("update_teams", {myTeam : p1Team, otherTeam : p2Team})
      p2.emit("update_teams", {myTeam : p2Team, otherTeam : p1Team})
    }

    //Check if the front yokai are all down and force a switch
    if (p1Team[0]["currentHP"] <= 0 && p1Team[1]["currentHP"] <= 0 && p1Team[2]["currentHP"] <= 0) {
      for (var i = 0; i < 3; i++){
          bInst["PLAYER_ONE"]["TEAM"].push(bInst["PLAYER_ONE"]["TEAM"].shift())
      }
      bInst["TURN_ORDER"] = [p1Team[0], p1Team[1], p1Team[2], p2Team[0], p2Team[1], p2Team[2]]

      p1.emit("front_fainted", { myTeam: battles[sentBATTLE_ID]["PLAYER_ONE"]["TEAM"], otherTeam: battles[sentBATTLE_ID]["PLAYER_TWO"]["TEAM"], downUID: bInst["PLAYER_ONE"]["UID"] })
      p2.emit("front_fainted", { myTeam: battles[sentBATTLE_ID]["PLAYER_TWO"]["TEAM"], otherTeam: battles[sentBATTLE_ID]["PLAYER_ONE"]["TEAM"], downUID: bInst["PLAYER_ONE"]["UID"] })
    }

    if (p2Team[0]["currentHP"] <= 0 && p2Team[1]["currentHP"] <= 0 && p2Team[2]["currentHP"] <= 0) {
      for (var i = 0; i < 3; i++){
        bInst["PLAYER_TWO"]["TEAM"].push(bInst["PLAYER_TWO"]["TEAM"].shift())
      }
      bInst["TURN_ORDER"] = [p1Team[0], p1Team[1], p1Team[2], p2Team[0], p2Team[1], p2Team[2]]

      p1.emit("front_fainted", { myTeam: battles[sentBATTLE_ID]["PLAYER_ONE"]["TEAM"], otherTeam: battles[sentBATTLE_ID]["PLAYER_TWO"]["TEAM"], downUID: bInst["PLAYER_TWO"]["UID"] })
      p2.emit("front_fainted", { myTeam: battles[sentBATTLE_ID]["PLAYER_TWO"]["TEAM"], otherTeam: battles[sentBATTLE_ID]["PLAYER_ONE"]["TEAM"], downUID: bInst["PLAYER_TWO"]["UID"] })
    }



    var p1UID = bInst["PLAYER_ONE"]["UID"]
    var p2UID = bInst["PLAYER_TWO"]["UID"]

    
    


    bInst["TURN_ORDER"] = [p1Team[0], p1Team[1], p1Team[2], p2Team[0], p2Team[1], p2Team[2]]

    var turnOrder = battles[sentBATTLE_ID]["TURN_ORDER"]

    //Update turn order
    for (var i = turnOrder.length - 1; i >= 0; i--) {
      if (turnOrder[i]["currentHP"] <= 0) {
        turnOrder.splice(i, 1)
        i--
      }
    }

    battles[sentBATTLE_ID]["TURN_ORDER"][0]["AP"] = calcAP(bInst["TURN_ORDER"][0]["spd"], 1)

    battles[sentBATTLE_ID]["TURN_ORDER"] = battles[sentBATTLE_ID]["TURN_ORDER"].sort((a, b) => a["AP"] - b["AP"])
  })

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    
    connectedClients.delete(socket.id)
  });

  // --- MISC EVENTS ---

  socket.on('start_soult', (sentBATTLE_ID, sentUID, sentIDX) => {
    var myTeam
    var otherTeam

    var bInst = battles[sentBATTLE_ID]
    var p1Team = bInst["PLAYER_ONE"]["TEAM"]
    var p2Team = bInst["PLAYER_TWO"]["TEAM"]

    if (sentUID == bInst["PLAYER_ONE"]["UID"]) {
      myTeam = bInst["PLAYER_ONE"]["TEAM"]
      otherTeam = bInst["PLAYER_TWO"]["TEAM"]

      myTeam[sentIDX]["charging"] = "chargING"
    } else {
      myTeam = bInst["PLAYER_TWO"]["TEAM"]
      otherTeam = bInst["PLAYER_ONE"]["TEAM"]

      myTeam[sentIDX]["charging"] = "chargING"
    }

    
  
  })

  socket.on('cast_soult', (sentBATTLE_ID, sentUID, sentIDX, sentMode) => {
    var myTeam
    var otherTeam

    var bInst = battles[sentBATTLE_ID]
    var p1Team = bInst["PLAYER_ONE"]["TEAM"]
    var p2Team = bInst["PLAYER_TWO"]["TEAM"]

    if (sentUID == bInst["PLAYER_ONE"]["UID"]) {
      myTeam = bInst["PLAYER_ONE"]["TEAM"]
      otherTeam = bInst["PLAYER_TWO"]["TEAM"]

      myTeam[sentIDX]["charging"] = "chargED"
      myTeam[sentIDX]["chargingType"] = sentMode
      bInst["PLAYER_ONE"]["CHARGING_IDX"] = sentIDX
    } else {
      myTeam = bInst["PLAYER_TWO"]["TEAM"]
      otherTeam = bInst["PLAYER_ONE"]["TEAM"]

      myTeam[sentIDX]["charging"] = "chargED"
      myTeam[sentIDX]["chargingType"] = sentMode
      bInst["PLAYER_TWO"]["CHARGING_IDX"] = sentIDX
    }

    
  
  })

  socket.on('pinned', (sentBATTLE_ID, sentUID, sentPin) => {

    var bInst = battles[sentBATTLE_ID]

    if (sentUID == bInst["PLAYER_ONE"]["UID"]) {
      bInst["PLAYER_ONE"]["PINNED"] = sentPin
    } else {
      bInst["PLAYER_TWO"]["PINNED"] = sentPin
    }

    
  
  })

  socket.on('validate_chat', (sentBATTLE_ID, sentUID, sentMessage) => {

    var bInst = battles[sentBATTLE_ID]

    var p1 = connectedClients.get(bInst["PLAYER_ONE"]["SOCKET_ID"])
    var p2 = connectedClients.get(bInst["PLAYER_TWO"]["SOCKET_ID"])

    var adjustedMessage = sentMessage.toLowerCase()
    var approved = true

    adjustedMessage = adjustedMessage.replaceAll("1", "i")
    adjustedMessage = adjustedMessage.replaceAll("4", "a")
    adjustedMessage = adjustedMessage.replaceAll("3", "e")
    adjustedMessage = adjustedMessage.replaceAll("0", "o")

    for (var i = 0; i < BANNED_TERMS.length; i++ ) {
      if ( adjustedMessage.includes(BANNED_TERMS[i]) ) {
        approved = false
      }
    }

    if (sentUID == bInst["PLAYER_ONE"]["UID"]) {
      
      if (approved) {
        p1.emit("chat_approved")
      } else {
        p1.emit("chat_denied")
      }

    } else {
      
      if (approved) {
        p2.emit("chat_approved")
      } else {
        p2.emit("chat_denied")
      }
      
    }

    
  
  })

  socket.on('send_chat', (sentBATTLE_ID, sentUID, sentMessage) => {

    var bInst = battles[sentBATTLE_ID]

    var p1 = connectedClients.get(bInst["PLAYER_ONE"]["SOCKET_ID"])
    var p2 = connectedClients.get(bInst["PLAYER_TWO"]["SOCKET_ID"])


    if (sentUID == bInst["PLAYER_ONE"]["UID"]) {
      p2.emit("chat_received", {username: bInst["PLAYER_ONE"]["USERNAME"], contents: sentMessage})
    } else {
      p1.emit("chat_received", {username: bInst["PLAYER_TWO"]["USERNAME"], contents: sentMessage})
    }

    
  
  })

  socket.on('purify_yokai', (sentBATTLE_ID, sentUID, sentIDX) => {
    var bInst = battles[sentBATTLE_ID]
    var purifySide = -1

    var p1 = connectedClients.get(bInst["PLAYER_ONE"]["SOCKET_ID"])
    var p2 = connectedClients.get(bInst["PLAYER_TWO"]["SOCKET_ID"])

    var p1Team = bInst["PLAYER_ONE"]["TEAM"]
    var p2Team = bInst["PLAYER_TWO"]["TEAM"]


    if (sentUID == bInst["PLAYER_ONE"]["UID"]) {

      for ( var i = p1Team[sentIDX]["currentInspirits"].length - 1; i >= 0; i-- ) {
        if ( p1Team[sentIDX]["currentInspirits"][i]["type"] == "negative" ) {
          p1Team[sentIDX]["currentInspirits"].splice(i, 1)
        }
      }

      p1.emit("yokai_purified", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "<em id = 'purify'>Your " + p1Team[sentIDX]["displayName"] + " was purified!"})
      p2.emit("yokai_purified", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "<em id = 'purify'>Opponent's " + p1Team[sentIDX]["displayName"] + " was purified!" })


    } else {

      for ( var i = p2Team[sentIDX]["currentInspirits"].length - 1; i >= 0; i-- ) {
        if ( p2Team[sentIDX]["currentInspirits"][i]["type"] == "negative" ) {
          p2Team[sentIDX]["currentInspirits"].splice(i, 1)
        }
      }

      p1.emit("yokai_purified", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "<em id = 'purify'>Opponent's " + p2Team[sentIDX]["displayName"] + " was purified!"})
      p2.emit("yokai_purified", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "<em id = 'purify'>Your " + p2Team[sentIDX]["displayName"] + " was purified!" })
    }
  });


  socket.on('poke_damage', (sentBATTLE_ID, sentUID, sentIDX) => {
    var bInst = battles[sentBATTLE_ID]

    var p1 = connectedClients.get(bInst["PLAYER_ONE"]["SOCKET_ID"])
    var p2 = connectedClients.get(bInst["PLAYER_TWO"]["SOCKET_ID"])

    var p1Team = bInst["PLAYER_ONE"]["TEAM"]
    var p2Team = bInst["PLAYER_TWO"]["TEAM"]


    if ( sentUID == bInst["PLAYER_ONE"]["UID"] ) {

      p2Team[sentIDX]["currentHP"] -= 50
      p2Team[sentIDX]["poked"] = true

      p1.emit("yokai_poked_damage", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "<em id = 'damage'> " + bInst["PLAYER_ONE"]["USERNAME"] + " poked the opposing " + p2Team[sentIDX]["displayName"] + " for damage!"})
      p2.emit("yokai_poked_damage", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "<em id = 'damage'>" + bInst["PLAYER_ONE"]["USERNAME"] + " poked your " + p2Team[sentIDX]["displayName"] + " for damage!" })


    } else {

      p1Team[sentIDX]["currentHP"] -= 50
      p1Team[sentIDX]["poked"] = true

      p1.emit("yokai_poked_damage", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "<em id = 'damage'>" + bInst["PLAYER_TWO"]["USERNAME"] + " poked your " + p1Team[sentIDX]["displayName"] + " for damage!"})
      p2.emit("yokai_poked_damage", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "<em id = 'damage'>" + bInst["PLAYER_TWO"]["USERNAME"] + " poked the opposing " + p1Team[sentIDX]["displayName"] + " for damage!" })
    }
  });

  socket.on('poke_soul', (sentBATTLE_ID, sentUID, sentIDX) => {
    var bInst = battles[sentBATTLE_ID]

    var p1 = connectedClients.get(bInst["PLAYER_ONE"]["SOCKET_ID"])
    var p2 = connectedClients.get(bInst["PLAYER_TWO"]["SOCKET_ID"])

    var p1Team = bInst["PLAYER_ONE"]["TEAM"]
    var p2Team = bInst["PLAYER_TWO"]["TEAM"]


    if ( sentUID == bInst["PLAYER_ONE"]["UID"] ) {
      if ( p2Team[sentIDX]["poked"] ) {
        return
      }

      p2Team[sentIDX]["soul"] -= 30
      if ( p2Team[sentIDX]["soul"] < 0 ) {
        p2Team[sentIDX]["soul"] = 0
      }

      p2Team[sentIDX]["poked"] = true

      p1Team[0]["soul"] += 10
      p1Team[1]["soul"] += 10
      p1Team[2]["soul"] += 10

      p1.emit("yokai_poked_soul", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "<em id = 'tech'> " + bInst["PLAYER_ONE"]["USERNAME"] + " poked the opposing " + p2Team[sentIDX]["displayName"] + " for soultimate charge!"})
      p2.emit("yokai_poked_soul", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "<em id = 'tech'>" + bInst["PLAYER_ONE"]["USERNAME"] + " poked your " + p2Team[sentIDX]["displayName"] + " for soultimate charge!" })


    } else {
      if ( p1Team[sentIDX]["poked"] ) {
        return
      }

      p1Team[sentIDX]["soul"] -= 30
      if ( p1Team[sentIDX]["soul"] < 0 ) {
        p1Team[sentIDX]["soul"] = 0
      }

      p1Team[sentIDX]["poked"] = true

      p2Team[0]["soul"] += 10
      p2Team[1]["soul"] += 10
      p2Team[2]["soul"] += 10

      p1.emit("yokai_poked_soul", { myTeam: p1Team, otherTeam: p2Team, chatMessage: "<em id = 'tech'>" + bInst["PLAYER_TWO"]["USERNAME"] + " poked your " + p1Team[sentIDX]["displayName"] + " for soultimate charge!"})
      p2.emit("yokai_poked_soul", { myTeam: p2Team, otherTeam: p1Team, chatMessage: "<em id = 'tech'>" + bInst["PLAYER_TWO"]["USERNAME"] + " poked the opposing " + p1Team[sentIDX]["displayName"] + " for soultimate charge!" })
    }
  });
});









// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Server functions

//VALIDATE_TEAM
function validate_team(sentTeam) {
  var problems = []


  for (var i = 1; i < sentTeam.length; i++) {
    var yokai = sentTeam[i]

    var totalIVs = parseInt(yokai.ivHP) + parseInt(yokai.ivSTR) + parseInt(yokai.ivSPR) + parseInt(yokai.ivDEF) + parseInt(yokai.ivSPD)
    var totalEVs = parseInt(yokai.evHP) + parseInt(yokai.evSTR) + parseInt(yokai.evSPR) + parseInt(yokai.evDEF) + parseInt(yokai.evSPD)

    if (40 - totalIVs < 0) {
      problems.push(" " + yokai.displayName + " has too many IVs!")
    }
    if (26 - totalEVs < 0) {
      problems.push(" " + yokai.displayName + " has too many EVs!")
    }

    var noGP = 0
    var statsCAPS = ["STR", "SPR", "DEF", "SPD"]

    for (var j = 0; j < 4; j++) {
      if (yokai["gp" + statsCAPS[j]] > 0) {
        noGP += 1
      }
      if (yokai["gp" + statsCAPS[j]] > 5) {
        problems.push(" " + yokai.displayName + " has too many GP in " + statsCAPS[i] + "! (Max is 5)")
      }
    }

    if (noGP > 1) {
      problems.push(" " + yokai.displayName + " has multiple stats with gp boosts!")
    }

  }

  if (problems.length == 0) {
    return "valid"
  } else {
    return problems
  }
}

function calcSPD(code, ivSPD, evSPD, gpSPD) {
  var part1 = parseFloat(YOKAI_DATABASE[code][`spdB`]) - parseFloat(YOKAI_DATABASE[code][`spdA`]) + parseFloat(ivSPD)
  var part2 = (part1 * 59) / 98
  var part3 = YOKAI_DATABASE[code][`spdA`] + part2
  var part4 = Math.floor(part3 + (parseFloat(evSPD) * (61 / 198)))
  part4 += (parseFloat(gpSPD * 5))
  return part4
} //Needs to be properly ported!!!

function rangeAP(sentSPD) {
  var SPD = sentSPD
  var AP = -1
  if (SPD <= 170) {
    AP = Math.floor((369 - Math.floor(SPD / 3) * 3))
  } else if (SPD <= 200) {
    AP = Math.floor((198 - Math.floor((SPD - 171) / 5) * 3))
  } else if (SPD <= 500) {
    AP = Math.floor((180 - Math.floor((SPD - 201) / 10) * 3))
  }

  return AP
} //Needs to be properly ported!!!

function getRangeAP(code) {
  var lowSPD = calcSPD(code, 0, 0, 0)
  var highSPD = calcSPD(code, 20, 26, 5)
  var lowAP = rangeAP(lowSPD)
  var highAP = rangeAP(highSPD)

  var finalRange = [lowAP, highAP]
  return finalRange
} //Needs to be properly ported!!!

function calcAP(sentSPD, sentMod) {

  var calculatedAP = -1

  if (sentSPD <= 170) {
    calculatedAP = Math.floor((369 - Math.floor(sentSPD / 3) * 3) * sentMod)
  } else if (sentSPD <= 200) {
    calculatedAP = Math.floor((198 - Math.floor((sentSPD - 171) / 5) * 3) * sentMod)
  } else if (sentSPD <= 500) {
    calculatedAP = Math.floor((180 - Math.floor((sentSPD - 201) / 10) * 3) * sentMod)
  }

  return calculatedAP
}

function weightedRandom(options) {
  let i, sum = 0, r = Math.random();
  for (i in options) {
    sum += options[i];
    if (r <= sum) return i;
  }
}


function attack(p1Team, p2Team, targetSide, targetIDX, turnOrder, critRoll) {
  var d1
  var overwrite = false

  var type = ATTACK_DATABASE[turnOrder[0]["na"]]["type"]
  var attribute = ATTACK_DATABASE[turnOrder[0]["na"]]["attribute"]
  var bp = ATTACK_DATABASE[turnOrder[0]["na"]]["bp"]
  var userSTR = turnOrder[0]["str"]
  var targetDEF = 0
  var targetGuard = 0
  var targetCode = ""

  var isCrit = 0
  var critMult = 1

  var isMiss = 0


  if (targetSide == 1) {
    targetDEF = p1Team[targetIDX]["def"]
    targetGuard = p1Team[targetIDX]["guard"]
    targetCode = p1Team[targetIDX]["code"]
  } else {
    targetDEF = p2Team[targetIDX]["def"]
    targetGuard = p2Team[targetIDX]["guard"]
    targetCode = p2Team[targetIDX]["code"]
  }

  if (critRoll == 0) {
    isCrit = 1
    targetDEF = 0
    critMult = 1.25
  }

  var res = 1
  var accMod = 0

  if (attribute == "none") {
    res = 1
  } else {
    res = YOKAI_DATABASE[targetCode][attribute]
  }

  //Check for abilities that activate
  for (var i = 0; i < p1Team.length; i++) {
    if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].includes("naCalc")) {
      var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["naCalc"](p1Team, p2Team, targetSide, targetIDX, turnOrder, type, attribute, bp, res, accMod, p1Team[i]["order"], 1, i)
      if (dataReturned != "skip") {
        d1 = dataReturned[0]
        isCrit = dataReturned[1]
        isMiss = dataReturned[2]
        overwrite = true
      }

    }
  }

  for (var i = 0; i < p2Team.length; i++) {
    if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].includes("naCalc")) {
      var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["naCalc"](p1Team, p2Team, targetSide, targetIDX, turnOrder, type, attribute, bp, res, accMod, p2Team[i]["order"], 2, i)
      if (dataReturned != "skip") {
        d1 = dataReturned[0]
        isCrit = dataReturned[1]
        isMiss = dataReturned[2]
        overwrite = true
      }

    }
  }

  if (overwrite) {
    return [d1, isCrit, 0]
  }


  //No skills active, run normally.


  var randMult = Math.random() * 0.2 + 0.9
  var finalMult = Math.round(randMult * 100) / 100 //Use this- not randMult!

  d1 = Math.floor(((userSTR / 2) + (bp / 2) - (targetDEF / 4)) * critMult * finalMult * res * targetGuard)

  



  return [d1, isCrit, 0]
}

function technique(p1Team, p2Team, targetSide, targetIDX, turnOrder, critRoll) {

  var d1
  var overwrite = false

  var type = TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["type"]
  var attribute = TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["attribute"]
  var bp = TECHNIQUE_DATABASE[turnOrder[0]["tech"]]["bp"]
  var userSPR = turnOrder[0]["spr"]
  var targetDEF = 0
  var targetGuard = 0
  var targetCode = ""

  var isCrit = 0
  var critMult = 1

  var isMiss = 0

  if (critRoll == 0) {
    isCrit = 1
    targetDEF = 0
    critMult = 1.25
  }

  if (targetSide == 1) {
    targetDEF = p1Team[targetIDX]["def"]
    targetGuard = p1Team[targetIDX]["guard"]
    targetCode = p1Team[targetIDX]["code"]
  } else {
    targetDEF = p2Team[targetIDX]["def"]
    targetGuard = p2Team[targetIDX]["guard"]
    targetCode = p2Team[targetIDX]["code"]
  }

  var res = 1

  if (attribute == "none") {
    res = 1
  } else {
    res = YOKAI_DATABASE[targetCode][attribute]
  }

  //Check for abilities that activate
  for (var i = 0; i < p1Team.length; i++) {
    if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("techCalc") > -1) {
      var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["techCalc"](p1Team, p2Team, targetSide, targetIDX, turnOrder, type, attribute, bp, res, p1Team[i]["order"], 1, i, critRoll)
      if (dataReturned != "skip") {
        d1 = dataReturned[0]
        isCrit = dataReturned[1]
        isMiss = dataReturned[2]
        overwrite = true
      }

    }
  }

  for (var i = 0; i < p2Team.length; i++) {
    if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("techCalc") > -1) {
      var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["techCalc"](p1Team, p2Team, targetSide, targetIDX, turnOrder, type, attribute, bp, res, p2Team[i]["order"], 2, i, critRoll)
      if (dataReturned != "skip") {
        d1 = dataReturned[0]
        isCrit = dataReturned[1]
        isMiss = dataReturned[2]
        overwrite = true
      }

    }
  }

  if (overwrite) {
    return [d1, isCrit, 0]
  }


  // No skills activated, run normally


  if (type == "damage") {


    var randMult = Math.random() * 0.2 + 0.9
    var finalMult = Math.round(randMult * 100) / 100 //Use this- not randMult!

    d1 = Math.floor(((userSPR / 2) + (bp / 2) - (targetDEF / 4)) * finalMult * critMult * res * targetGuard)


  } else if (type == "drain") {
    var res = 1

    var randMult = Math.random() * 0.2 + 0.9
    var finalMult = Math.round(randMult * 100) / 100 //Use this- not randMult!

    d1 = Math.floor(((userSPR / 2) + (bp / 2) - (targetDEF / 4)) * finalMult * critMult * res * targetGuard)


  } else {

    var randMult = Math.random() * 0.2 + 0.9
    var finalMult = Math.round(randMult * 100) / 100 //Use this- not randMult!

    d1 = Math.floor(((userSPR / 2) + (bp / 2) - (targetDEF / 4)) * finalMult * critMult * targetGuard)


  }

  var missRoll = Math.floor(Math.random() * 25)

  if (missRoll == 0) {
    d1 = 0
    isMiss = 1
  }

  return [d1, isCrit, 0]
}

function inspirit(p1Team, p2Team, targetSide, targetIDX, turnOrder) {
  
  var type = INSPIRIT_DATABASE[turnOrder[0]["insp"]]["type"]

  var inspTarget = -1

  if ( type == "positive" && targetSide == 1 ) {
    inspTarget = 2
  } else if ( type == "positive" && targetSide == 2) {
    inspTarget = 1
  } else if ( type == "negative" ) {
    inspTarget = targetSide
  }

  var missRoll = Math.floor(Math.random() * 20)

  // --- SUPERNATURAL SOUL ---
  if ( targetSide == 1 ) {

    for ( var i = 0; i < 3; i++ ) {
      for ( var x = 0; x < p2Team[i]["items"].length; x++ ) {

        if ( p2Team[i]["items"][x]["displayName"] == "Supernatural Soul" ) {
          missRoll = 999
        }

      }
    }

  } else {
    for ( var i = 0; i < 3; i++ ) {
      for ( var x = 0; x < p1Team[i]["items"].length; x++ ) {

        if ( p1Team[i]["items"][x]["displayName"] == "Supernatural Soul" ) {
          missRoll = 999
        }

      }
    }
  }

  if (inspTarget == 2 && !(missRoll == 0)) {
    p2Team[targetIDX]["currentInspirits"].push({
      "code": turnOrder[0]["insp"],
      "tag": INSPIRIT_DATABASE[turnOrder[0]["insp"]]["tags"],
      "type": type,
      "age": 0,
    })
  } else if (!(missRoll == 0)) {
    p1Team[targetIDX]["currentInspirits"].push({
      "code": turnOrder[0]["insp"],
      "tag": INSPIRIT_DATABASE[turnOrder[0]["insp"]]["tags"],
      "type": type,
      "age": 0,
    })
  }
  

  switch ( INSPIRIT_DATABASE[turnOrder[0]["insp"]]["tags"][0] ) {
    case "strUp":

      if ( inspTarget == 1) {
        p1Team[targetIDX]["str"] += 50
      } else {
        p2Team[targetIDX]["str"] += 50
      }

      break
    
    case "strDown":

      if ( inspTarget == 1) {
        p1Team[targetIDX]["str"] -= 50
      } else {
        p2Team[targetIDX]["str"] -= 50
      }

      break
    
    case "sprUp":

      if ( inspTarget == 1) {
        p1Team[targetIDX]["spr"] += 50
      } else {
        p2Team[targetIDX]["spr"] += 50
      }

      break
    
    case "sprDown":

      if ( inspTarget == 1) {
        p1Team[targetIDX]["spr"] -= 50
      } else {
        p2Team[targetIDX]["spr"] -= 50
      }

      break
    
    case "defUp":

      if ( inspTarget == 1) {
        p1Team[targetIDX]["def"] += 50
      } else {
        p2Team[targetIDX]["def"] += 50
      }

      break
    
    case "defDown":

      if ( inspTarget == 1) {
        p1Team[targetIDX]["def"] -= 50
      } else {
        p2Team[targetIDX]["def"] -= 50
      }

      break
    
    case "spdUp":

      if ( inspTarget == 1) {
        p1Team[targetIDX]["spd"] += 50
      } else {
        p2Team[targetIDX]["spd"] += 50
      }

      break
    
    case "spdDown":

      if ( inspTarget == 1) {
        p1Team[targetIDX]["spd"] -= 50
      } else {
        p2Team[targetIDX]["spd"] -= 50
      }

      break
    
    case "allUp":

      if ( inspTarget == 1) {
        p1Team[targetIDX]["str"] += 50
        p1Team[targetIDX]["spr"] += 50
        p1Team[targetIDX]["def"] += 50
        p1Team[targetIDX]["spd"] += 50
      } else {
        p2Team[targetIDX]["str"] += 50
        p2Team[targetIDX]["spr"] += 50
        p2Team[targetIDX]["def"] += 50
        p2Team[targetIDX]["spd"] += 50
      }

      break
    
    case "allDown":

      if ( inspTarget == 1) {
        p2Team[targetIDX]["str"] += 50
        p2Team[targetIDX]["spr"] += 50
        p2Team[targetIDX]["def"] += 50
        p2Team[targetIDX]["spd"] += 50
      } else {
        p2Team[targetIDX]["str"] += 50
        p2Team[targetIDX]["spr"] += 50
        p2Team[targetIDX]["def"] += 50
        p2Team[targetIDX]["spd"] += 50
      }

      break
      
  }


  return [type, missRoll]
}

function soultimate(p1Team, p2Team, targetSide, targetIDX, turnOrder, critRoll, moxieBuff) {

  var d1
  var overwrite = false

  var type = SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["type"]
  var attribute = SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["attribute"]
  var bp = SOULTIMATE_DATABASE[turnOrder[0]["soult"]]["bp"]
  var userSTR = turnOrder[0]["str"]
  var userSPR = turnOrder[0]["spr"]
  var targetDEF = 0
  var targetGuard = 0
  var targetCode = ""
  
  var isCrit = 0
  var critMult = 1

  var isMiss = 0

  if (critRoll == 0) {
    isCrit = 1
    targetDEF = 0
    critMult = 1.25
  }

  if (targetSide == 1) {
    targetDEF = p1Team[targetIDX]["def"]
    targetGuard = p1Team[targetIDX]["guard"]
    targetCode = p1Team[targetIDX]["code"]
  } else {
    targetDEF = p2Team[targetIDX]["def"]
    targetGuard = p2Team[targetIDX]["guard"]
    targetCode = p2Team[targetIDX]["code"]
  }

  var res = 1

  if (attribute == "none") {
    res = 1
  } else {
    res = YOKAI_DATABASE[targetCode][attribute]
  }

  //Check for abilities that activate
  for (var i = 0; i < p1Team.length; i++) {
    if (SKILL_DATABASE[p1Team[i]["skill"]]["events"].indexOf("soultCalc") > -1) {
      var dataReturned = SKILL_DATABASE[p1Team[i]["skill"]]["soultCalc"](p1Team, p2Team, targetSide, targetIDX, turnOrder, type, attribute, bp, res, p1Team[i]["order"], 1, moxieBuff)
      if (dataReturned != "skip") {
        d1 = dataReturned[0]
        isCrit = dataReturned[1]
        isMiss = dataReturned[2]
        overwrite = true
      }

    }
  }

  for (var i = 0; i < p2Team.length; i++) {
    if (SKILL_DATABASE[p2Team[i]["skill"]]["events"].indexOf("soultCalc") > -1) {
      var dataReturned = SKILL_DATABASE[p2Team[i]["skill"]]["soultCalc"](p1Team, p2Team, targetSide, targetIDX, turnOrder, type, attribute, bp, res, p2Team[i]["order"], 2, moxieBuff)
      if (dataReturned != "skip") {
        d1 = dataReturned[0]
        isCrit = dataReturned[1]
        isMiss = dataReturned[2]
        overwrite = true
      }

    }
  }

  // --- GRD SOUL ---
  for ( var i = 0; i < turnOrder[0]["items"].length; i++ ) {

    if ( turnOrder[0]["items"][i]["displayName"] == "Greesel/Robodraggie (GRD) Soul" ) {
      d1 = d1 * 1.5
    }

  }

  if (overwrite) {
    return [d1, isCrit, 0]
  }





  if ( attribute == "none" ) {


    var randMult = Math.random() * 0.2 + 0.9
    var finalMult = Math.round(randMult * 100) / 100 //Use this- not randMult!

    d1 = Math.floor(((userSTR / 2) + (bp / 2) - (targetDEF / 4)) * finalMult * critMult * res * targetGuard * moxieBuff)


  } else {

    var randMult = Math.random() * 0.2 + 0.9
    var finalMult = Math.round(randMult * 100) / 100 //Use this- not randMult!

    d1 = Math.floor(((userSPR / 2) + (bp / 2) - (targetDEF / 4)) * finalMult * critMult * res * targetGuard * moxieBuff)


  }

  // --- GRD SOUL ---
  for ( var i = 0; i < turnOrder[0]["items"].length; i++ ) {

    if ( turnOrder[0]["items"][i]["displayName"] == "Greesel/Robodraggie (GRD) Soul" ) {
      d1 = d1 * 1.5
    }

  }


  return [d1, isCrit, 0]
}


// -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------


// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});