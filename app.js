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

var setElo = function( slackId, elo ) {
  var deferred = Q.defer();

  console.log( '= SETTING ELO. slack id [' + slackId + '] elo [' + elo + ']' );

  controller.storage.users.save( { id: slackId, elo: 1000 }, function( err ) {
    deferred.resolve( getElo( slackId ) );
  });
}

var getElo = function( slackId ) {
  // getuser
  // then return elo
  // if user does not exist then create a new one with empty elo
  console.log( 'start getElo for id ' + slackId );
  var deferred = Q.defer();



  var slackUser = controller.storage.users.get( slackId, function( err, elo ) {

    if( err && !elo ) {
      deferred.resolve( setElo( slackId, 1000 ) );
    }

    deferred.resolve( elo );
  } );
}

var getPlayers = function( players ) {
  var deferred = Q.defer();

  console.log( 'start fetching players' );

  try {
    results = _.map( players, getElo )
  } catch( e ) {
    console.log( e );
  }
  console.log( results );

  deferred.resolve( results );
}

var score = function ( options, cb ) {
  var winner = options.winner;
  var loser = options.loser;


/*
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
  */
}

controller.hears( ['beat'],'direct_mention', function( bot, message ) {
  var parsed = message.text.split(' '),
    winner = parsed[0],
    loser = parsed[2],
    game = parsed[4],
    bot = bot;

  var scoreOptions = {
    winner:winner.substr( 2, winner.length - 3),
    loser:loser.substr( 2, loser.length - 3)
  };

  bot.startConversation( message, function( err, conversation) {
    var deferred = Q.defer();

    bot.say( 'calculating elo for ' + winner + ' beats ' + loser );

    getPlayers( [winner, loser] );
      // .then( calculateElo )
      // .then( getActualRatings )
      // .then( reportResults )
      // .then( storePlayers );

    deferred.resolve();
    // results = score( scoreOptions, function( results ) {
    //   //bot.say( message, 'hi! ' + results.winner.user + ' new elo' + results.winner.elo );
    // });
  });


});

/*
 * find winner in db (or add with default score)
 * find loser in db (or add with default score)
 * update elo in both
 *
 *
 * */
