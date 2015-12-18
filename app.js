var _ = require('lodash');
var Botkit = require('Botkit');
var elo = require('elo-rank')();
var Q = require('q');

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

var xBeatY = {};

xBeatY.getElo = function( slackId ) {
  var slackUser = controller.storage.users.get( slackId, function( err, user ) {

    if( err && !user ) {
      this.setElo( slackId, 1000 );
    }
  } );
}

xBeatY.setElo = function( slackId, elo ) {
  controller.storage.users.save( { id: slackId, elo: 1000 }, function( err ) {
    this.getElo( slackId );
  });
}

xBeatY.score = function ( options, cb ) {
  var winner = options.winner;
  var loser = options.loser;

  var winnerElo = this.getElo( winner );
  var loserElo = this.getElo( loser);

  expectedWinner = elo.getExpected( winnerElo, loserElo );
  expectedLoser = elo.getExpected( loserElo, winnerElo );

  winnerElo = elo.updateRating( expectedWinner, 1, winnerElo );
  loserElo = elo.updateRating( expectedLoser, 0, loserElo );

  this.setElo( winner, winnerElo );
  this.setElo( loser, loserElo );

  results = {
    winner: {
      user: winner,
      elo: winnerElo
    },
    loser: {
      user: loser,
      elo: loserElo
    }
  }

  cb( results );
}

controller.hears( ['beat'],'direct_mention', function( bot, message ) {
  var parsed = message.text.split(' '),
    winner = parsed[0],
    loser = parsed[2],
    game = parsed[4];

  var scoreOptions = {
    winner:winner.substr( 2, winner.length - 3),
    loser:loser.substr( 2, loser.length - 3)
  };

  results = xBeatY.score( scoreOptions, function( results ) {
    bot.reply( message, 'hi! ' + results.winner.user + ' new elo' + results.winner.elo );
  });
});

/*
 * find winner in db (or add with default score)
 * find loser in db (or add with default score)
 * update elo in both
 *
 *
 * */
