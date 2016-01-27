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

  controller.storage.users.save( { id: slackId, elo: 1000 }, function( err ) {
    console.log( '[setElo] user saved. resolving with promise to get elo' );
    deferred.resolve( getElo( slackId ) );
  });
}

var getElo = function( slackId, role ) {
  console.log( '[getElo] START for id ' + slackId );
  var deferred = Q.defer();
  var role = role;

  var slackUser = controller.storage.users.get( slackId, function( err, elo ) {
    if( err && !elo ) {
      console.log( '[getElo] elo not found. creating new user ' );
      deferred.resolve( setElo( slackId, 1000 ) );
    }

    elo["role"] = role;

    console.log( '[getElo] found elo. resolving promise with following object:' );
    console.log( elo );

    deferred.resolve( elo );
  }.bind( this ) );

  return deferred.promise;
}

var getPlayers = function( conch ) {
  var deferred = Q.defer();
  var players = conch.players;

  console.log( '[getPlayers] start. getting ' + players.length + ' players.' );

  var loadedPlayers =  Q.all([
    getElo( conch.players.winner, 'winner' ),
    getElo( conch.players.loser, 'loser' )
  ]).then(
    function( loadedPlayers ) {
      console.log( '=====' );
      console.log( loadedPlayers );
      console.log( '=====' );
      var playerIndex = 0;

      for( playerIndex = 0; playerIndex < loadedPlayers.length; playerIndex++ ) {
        if( loadedPlayers[playerIndex].role === 'winner' ) {
          conch.winner = loadedPlayers[playerIndex];
        }

        if( loadedPlayers[playerIndex].role === 'winner' ) {
          conch.loser = loadedPlayers[playerIndex];
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
  var deferred = Q.defer();

  var expectedWinner = elo.getExpected( conch.winner.elo, conch.loser.elo );
  var expectedLoser = elo.getExpected( conch.loser.elo, conch.winner.elo );

  console.log( '[calculateElo] expectedWinner: ' + expectedWinner );
  console.log( '[calculateElo] expectedLoser: ' + expectedLoser );

  var winnerElo = elo.updateRating( expectedWinner, 1, conch.winner.elo );
  var loserElo = elo.updateRating( expectedLoser, 0, conch.loser.elo );

  console.log( '[calculateElo] winnerElo: ' + winnerElo );
  console.log( '[calculateElo] loserElo: ' + loserElo );

  Q.all( [
    setElo( conch.winner.id, winnerElo ),
    setElo( conch.loser.id, loserElo )
  ]).then( function( newElos ) {
    console.log( newElos );

    console.log( '[calculateElo] resolving promise WITH NEW ELOs: ' );
    console.log( newElos );
    deferred.resolve( newElos );
  });

  console.log( '[calculateElo] resolving promise' );
  deferred.resolve( conch );

  return deferred.promise;
}

var reportResults = function( conch ) {
  var deferred = Q.defer();

  console.log( '[reportResults] trying to talk' );

  var winner = conch[0].id;
  var loser = conch[1].id;

  bot.reply( message, 'calculating elo for ' + winner + ' beats ' + loser );

  deferred.resolve( conch );

  return deferred.promise;
  // bot.startConversation( message, function( err, conversation) {
  //   var deferred = Q.defer();
  //
  //   //
  //
  //
  //   deferred.resolve();
  //   // results = score( scoreOptions, function( results ) {
  //   //   //bot.say( message, 'hi! ' + results.winner.user + ' new elo' + results.winner.elo );
  //   // });
  // });


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
      "winner": winner,
      "loser": loser
    },
    bot:  bot,
    message: message
  };

  getPlayers( conch )
    .then( calculateElo )
    .then( reportResults )
    .then( outputPromise )
    .fail( function( error ) {
      console.log( 'Failure in chain: ' );
      console.log( error );
    });
});
