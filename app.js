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
  console.log( '[setElo] start for slackid:[' + slackId + '] elo:[' + elo + ']' );

  var deferred = Q.defer();

  controller.storage.users.save( { id: slackId, elo: 1000 }, function( err ) {
    console.log( '[setElo] user saved. resolving with promise to get elo' );
    deferred.resolve( getElo( slackId ) );
  });
}

var getElo = function( slackId ) {
  console.log( '[getElo] START for id ' + slackId );
  var deferred = Q.defer();

  var slackUser = controller.storage.users.get( slackId, function( err, elo ) {

    if( err && !elo ) {
      console.log( '[getElo] elo not found. creating new user ' );
      deferred.resolve( setElo( slackId, 1000 ) );
    }

    console.log( '[getElo] found elo. resolving promise with ' + elo );
    deferred.resolve( elo );
  } );
}

var getPlayers = function( players ) {
  //var deferred = Q.defer();

  console.log( '[getPlayers] start. getting ' + players.length + ' players.' );

  return Q.all( _.map( players, getElo ), function( loadedPlayers ) {
    console.log( '[getPlayers] resolving with contents output on next line, which is array of found players' );
    console.log( loadedPlayers );
    return loadedPlayers;
  });

  //deferred.resolve();
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

var reportResults = function() {
  bot.startConversation( message, function( err, conversation) {
    var deferred = Q.defer();

    //bot.say( 'calculating elo for ' + winner + ' beats ' + loser );


    deferred.resolve();
    // results = score( scoreOptions, function( results ) {
    //   //bot.say( message, 'hi! ' + results.winner.user + ' new elo' + results.winner.elo );
    // });
  });


}

var outputPromise = function( parameter ) {
  console.log( '[outputPromise] this is:' );
  console.log( this );

  console.log( '[outputPromise] typeof this:' + typeof( this ));

  console.log( '[outputPromise] received following as parameter' );
  console.log( promise );
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

  getPlayers( [winner, loser] )
    // .then( calculateElo )
    // .then( getActualRatings )
    // .then( reportResults )
    // .then( storePlayers );)
    .then( outputPromise );
});

/*
 * find winner in db (or add with default score)
 * find loser in db (or add with default score)
 * update elo in both
 *
 *
 * */
