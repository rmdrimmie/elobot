"use strict";

// test with:
// @navi @rob beat @howdy
//
// tests:
//  - players don't exist
//  - ladders
//  - ?

var _ = require('lodash');
var Botkit = require('Botkit');
var elo = require('elo-rank')();
var Q = require('q');

var bot, message;

if (!process.env.token) {
  console.error( 'Error: Specify token in environment' );
  process.exit(1);
}

var controller = Botkit.slackbot({
  json_file_store: './db_navi/',
  debug: false,
});

controller.spawn({
  token: process.env.token
}).startRTM(function(err) {
  if (err) {
    throw new Error(err);
  }
});

var setElo = function( slackId, elo ) {
  console.log( '[setElo] start for slackid:[' + slackId + '] elo:[' + elo + ']' );

  var deferred = Q.defer();

  controller.storage.users.save( { id: slackId, elo: elo }, function( err ) {
    console.log( '[setElo] user saved. resolving with promise to get elo' );
    deferred.resolve( getElo( slackId ) );
  });

  return deferred.promise;
}

var getElo = function( slackId ) {
  console.log( '[getElo] START for id ' + slackId );
  var deferred = Q.defer();

  var slackUser = controller.storage.users.get( slackId, function( err, elo ) {
    if( err && !elo ) {
      console.log( '[getElo] elo not found. creating new user ' );
      deferred.resolve( setElo( slackId, 1000 ) );
    } else {

      console.log( '[getElo] found elo. resolving promise with following object:' );
      console.log( elo );

      deferred.resolve( elo );
    }
  }.bind( this ) );

  return deferred.promise;
}

var getPlayers = function( conch ) {
  var deferred = Q.defer();
  var players = conch.players;

  console.log( '[getPlayers] start' );

  var loadedPlayers =  Q.all([
    getElo( conch.players.winner.id, 'winner' ),
    getElo( conch.players.loser.id, 'loser' )
  ]).then(
    function( loadedPlayers ) {
      var playerIndex = 0;

      for( playerIndex = 0; playerIndex < loadedPlayers.length; playerIndex++ ) {
        if( loadedPlayers[playerIndex].id === conch.players.winner.id ) {
          conch.players.winner = loadedPlayers[playerIndex];
          conch.players.winner.oldElo = conch.players.winner.elo;
        }

        if( loadedPlayers[playerIndex].id === conch.players.loser.id ) {
          conch.players.loser = loadedPlayers[playerIndex];
          conch.players.loser.oldElo = conch.players.loser.elo;
        }
      }

      console.log( '[getPlayers] resolving' );

      deferred.resolve( conch );
    }
  );

  return deferred.promise;
}

var calculateElo = function( conch ) {
  console.log( '[calculateElo] starting' );
  var results = {};

  var expectedWinner = elo.getExpected( conch.players.winner.elo, conch.players.loser.elo );
  var expectedLoser = elo.getExpected( conch.players.loser.elo, conch.players.winner.elo );

  console.log( '[calculateElo] expectedWinner: ' + expectedWinner );
  console.log( '[calculateElo] expectedLoser: ' + expectedLoser );

  conch.players.winner.elo = elo.updateRating( expectedWinner, 1, conch.players.winner.elo );
  conch.players.loser.elo = elo.updateRating( expectedLoser, 0, conch.players.loser.elo );

  console.log( '[calculateElo] winnerElo: ' + conch.players.winner.elo );
  console.log( '[calculateElo] loserElo: ' + conch.players.loser.elo );

  console.log( '[calculateElo] returning updated conch' );

  return conch;
}

var updatePlayers = function( conch ) {
  var deferred = Q.defer();
  var conch = conch;

  console.log( '[updatePlayers] start' );

  Q.all( [
    setElo( conch.players.winner.id, conch.players.winner.elo ),
    setElo( conch.players.loser.id, conch.players.loser.elo )
  ]).then( function( newElos ) {

    console.log( newElos );

    for( var newEloIndex = 0; newEloIndex < newElos.length; newEloIndex++ ) {
      if( newElos[newEloIndex].id === conch.players.winner.id ) {
        conch.players.winner.elo = newElos[newEloIndex].elo;
      }

      if( newElos[newEloIndex].id === conch.players.loser.id ) {
        conch.players.loser.elo = newElos[newEloIndex].elo;
      }
    }

    console.log( '[updatePlayers] resolving promise.' );
    deferred.resolve( conch );
  });

  return deferred.promise;
}

var reportResults = function( conch ) {
  var deferred = Q.defer();

  console.log( '[reportResults] Reporting results ' );

  var response = 'Winner ' + conch.players.winner.id + ' elo from ' + conch.players.winner.oldElo + ' to ' + conch.players.winner.elo +
    ' Loser ' + conch.players.loser.id + ' elo from ' + conch.players.loser.oldElo + ' to ' + conch.players.loser.elo

  console.log( '[reportResults] replying with mention of winners' );

  bot.reply( message, response );

  deferred.resolve( conch );

  return deferred.promise;
}

var outputPromise = function( conch ) {
  console.log( '[outputPromise] received conch.' );
}

controller.hears( ['beat'],'direct_mention', function( _bot, _message ) {
  var parsed = _message.text.split(' '),
    winner = parsed[0],
    loser = parsed[2],
    game = parsed[4];

  bot = _bot;
  message = _message;

  var scoreOptions = {
    winner:winner.substr( 2, winner.length - 3),
    loser:loser.substr( 2, loser.length - 3)
  };

  var conch = {
    players:  {
      "winner": {
        id: winner,
        elo: 1000,
        oldElo: 1000
      },
      "loser": {
        id: loser,
        elo: 1000,
        oldElo: 1000
      }
    },
    bot:  bot,
    message: message
  };

  getPlayers( conch )
    .then( calculateElo )
    .then( updatePlayers )
    .then( reportResults )
    .then( outputPromise )
    .fail( function( error ) {
      console.log( 'Failure in chain: ' );
      console.log( error );
    });
});
