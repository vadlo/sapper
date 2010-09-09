/**
 * ACHTUNG!
 *
 * This script might take some time to process if the bomb quantity is low.
 * I have not sought to design the fastest sapper ever -- in that case I would
 * have chosen another language ;)
 * I had 2 goals:
 * 1. design nice javascript game in object-oriented style
 * 2. create algorythm that finds all not-mined squares, *all* of them (Crawler::crawl)
 * as the drawback of all scripts I've seen was imperfectness of this algorythm.
 */

/*
 * @desc Game settings
 */
var Settings = (function() {
  var _FIELD_ID = 'field';
  var _SQUARE_CLASS_NAME = 'square';
  var _X_FIELD_SIZE = 15;
  var _Y_FIELD_SIZE = 15;
  var _SQUARE_SIZE = 30;
  var _BOMB_QUANTITY = 30;
  var _DEBUG_MODE = false;
  var _LOOSER_DIV_ID = 'looser';
  var _CONGRATS_DIV_ID = 'congrats';
  return {
    getDebugMode: function() {
      return _DEBUG_MODE;
    },
    getFieldId: function() {
      return _FIELD_ID;
    },
    getXFieldSize: function() {
      return _X_FIELD_SIZE;
    },
    getYFieldSize: function() {
      return _Y_FIELD_SIZE;
    },
    getBombQuantity: function() {
      return _BOMB_QUANTITY;
    },
    getSquareClassName: function() {
      return _SQUARE_CLASS_NAME;
    },
    getSquareSize: function() {
      return _SQUARE_SIZE;
    },
    getLooserDivId: function() {
      return _LOOSER_DIV_ID;
    },
    getCongratsDivId: function() {
      return _CONGRATS_DIV_ID;
    }
  }
})();

var Initiator = (function() {
  return function() {
    return {
      init: function() {
        var crawler = new Crawler();

        var field = new Field();
        field.empty();
        field.draw();
        field.setCrawler(crawler);
        field.bindClicks();

        crawler.setField(field);

        var seeder = new Seeder()
        seeder.setField(field);
        seeder.seed();
      }
    }
  }
})();

/*
 * @desc Crawler crawls the field and performs 2 tasks:
 * 1. looks for squares with no bombs
 * 2. counts the bomb quantity around each square
 */
var Crawler = function() {
  var _history = new Object();
  var _field = null;
  function countMines(square) {
    var minesQuantity = 0;
    var position = square.getPosition();
    for (var i = -1; i < 2; i++) {
      for (var j = -1; j < 2; j++) {
        var _left = parseInt(position.left) + parseInt(i*Settings.getSquareSize());
        var _top = parseInt(position.top) + parseInt(j*Settings.getSquareSize());
        var currentSquare = _field.getSquareByPosition(_left + '.' + _top);
        if (currentSquare != undefined && currentSquare.hasMine()) {
          minesQuantity++;
        }
      }
    }

    return minesQuantity;
  }
  return {
    setField: function(field) {
      _field = field;
    },
//    History hash table
//'128' => {
//           'channel': 8 // channel we turned out here through - last digit in path
//         }

//   Channels
//    
//  1   2   3
//    +---+
//  8 |   | 4
//    +---+
//  7   6   5
    crawl: function(square, entryChannel, rollbacked) {
      // entryChannel is a channel we turned out in this square through, relative to this square
      var _minesQuantity = countMines(square);
      square.open(_minesQuantity);
      if (_minesQuantity != 0) {
        // rollback on previous position
        // define the position of the square we return to
        var returningSquare = square.getAdjacentSquare(entryChannel);
        if (returningSquare != undefined) {
          this.crawl(returningSquare, Field.invertChannel(entryChannel), true);
        }
        
        return;
      } else {
        // first time here?
        if (_history[square.getPosition().left + '.' + square.getPosition().top] == undefined) {
          var currentChannel = 1;

          for (var i = currentChannel; i < 9; i++) {
            var nextSquare = square.getAdjacentSquare(i);
            if (nextSquare != undefined) {
              currentChannel = i;
              break;
            }
          }

          _history[square.getPosition().left + '.' + square.getPosition().top] = {
                                                                                  activeChannel: currentChannel,
                                                                                  entryChannel: entryChannel
                                                                                };
          this.crawl(nextSquare, Field.invertChannel(currentChannel));
        }
        // been here before
        else {
          // if this is a rollback -- continue from the next channel
          if (rollbacked != undefined && rollbacked === true) {
            _history[square.getPosition().left + '.' + square.getPosition().top].activeChannel = entryChannel;
            var currentChannel2 = entryChannel;
            for (var i2 = currentChannel2 + 1; i2 < 9; i2++) {
              var nextSquare2 = square.getAdjacentSquare(i2);
              if (nextSquare2 != undefined) {
                currentChannel2 = i2;
                break;
              }
            }
            if (nextSquare2 != undefined) {
              this.crawl(nextSquare2, Field.invertChannel(currentChannel2));
            }
            else {
              // rollback to the square we come from here, not to the square we rollbacked from
              var previousSquare = square.getAdjacentSquare(
                _history[square.getPosition().left + '.' + square.getPosition().top].entryChannel);
              if (previousSquare != undefined) {
                this.crawl(previousSquare, Field.invertChannel(entryChannel), true);
              }
              return;
            }
            return;
          }
          else {
            // rolback to previous square
            var previousSquare2 = square.getAdjacentSquare(entryChannel);
            if (previousSquare2 != undefined) {
              this.crawl(previousSquare2, Field.invertChannel(entryChannel), true);
            }
            return;
          }
        }
      }
    }
  }
}

var Field = function() {
  _mineLocation = new Object();
  _squares = new Object();
  _crawler = null;

  return {
    showMines: function(color) {
      for (var location in this.getMineLocation()) {
        this.getSquareByPosition(location).indicateBomb(color);
      }
    },
    setCrawler: function(crawler) {
      _crawler = crawler;
    },
    bindClicks: function() {
      var _this = this;
      $('.' + Settings.getSquareClassName()).click(function(e) {
        var clickedId = $(this).attr('id');
        var aPosition = clickedId.split('.');
        var square = _this.getSquareByPosition(aPosition[0] + '.' + aPosition[1]);
        if (square.hasBomb()) {
          _this.showMines();
          $('#' + Settings.getLooserDivId()).show();
        } else {
          _crawler.crawl(square);
          if ((Settings.getXFieldSize() * Settings.getXFieldSize() - _this.getOpenSquaresQuantity()) === Settings.getBombQuantity()) {
            $('#' + Settings.getCongratsDivId()).show();
          }
        }
      })
    },
    getSquareByPosition: function(location) {
      return _squares[location];
    },
    getMineLocation: function() {
      return _mineLocation;
    },
    empty: function() {
      $('#' + Settings.getFieldId()).empty();
    },
    getOpenSquaresQuantity: function() {
      _openFieldsQuantity = 0;
      for (var position in _squares) {
        var square = _squares[position];
        if (square.isOpen()) {
          _openFieldsQuantity++;
        }
      }

      return _openFieldsQuantity;
    },
    draw: function() {
      for (var i = 0; i < Settings.getXFieldSize(); i++) {
        for (var j = 0; j < Settings.getYFieldSize(); j++) {
          var square = new Square();
          square.setField(this);
          square.append();
          _position = square.getPosition();
          square.setId(_position.left + '.' + _position.top);
          _squares[_position.left + '.' + _position.top] = square;
        }
      }
    }
  }
}

Field.invertChannel = function(channel) {
  return channel <= 4 ? channel + 4 : channel - 4;
}

function Square() {
  var _jQueryObject = null;
  var _field = null;
  var _opened = false;
  return {
    getAdjacentSquare: function(channel) {
      var thisPosition = this.getPosition();
      var newPosition = new Object();
      switch(channel) {
        case 1:
          newPosition.left = parseInt(thisPosition.left) - parseInt(Settings.getSquareSize());
          newPosition.top = parseInt(thisPosition.top) - parseInt(Settings.getSquareSize());
          break;
        case 2:
          newPosition.left = parseInt(thisPosition.left);
          newPosition.top = parseInt(thisPosition.top) - parseInt(Settings.getSquareSize());
          break;
        case 3:
          newPosition.left = parseInt(thisPosition.left) + parseInt(Settings.getSquareSize());
          newPosition.top = parseInt(thisPosition.top) - parseInt(Settings.getSquareSize());
          break;
        case 4:
          newPosition.left = parseInt(thisPosition.left) + parseInt(Settings.getSquareSize());
          newPosition.top = parseInt(thisPosition.top);
          break;
        case 5:
          newPosition.left = parseInt(thisPosition.left) + parseInt(Settings.getSquareSize());
          newPosition.top = parseInt(thisPosition.top) + parseInt(Settings.getSquareSize());
          break;
        case 6:
          newPosition.left = parseInt(thisPosition.left);
          newPosition.top = parseInt(thisPosition.top) + parseInt(Settings.getSquareSize());
          break;
        case 7:
          newPosition.left = parseInt(thisPosition.left) - parseInt(Settings.getSquareSize());
          newPosition.top = parseInt(thisPosition.top) + parseInt(Settings.getSquareSize());
          break;
        case 8:
          newPosition.left = parseInt(thisPosition.left) - parseInt(Settings.getSquareSize());
          newPosition.top = parseInt(thisPosition.top);
          break;
        default:
          break;
      }

      return _field.getSquareByPosition(newPosition.left + '.' + newPosition.top);
    },
    open: function() {
      if (! _opened) {
        if (arguments.length > 0 && parseInt(arguments[0]) > 0) {
          _jQueryObject.append('<h3>' + parseInt(arguments[0]) + '</h3>');
        }
        _jQueryObject.css({
          background: '#fff'
        });
        _opened = true;
      }
    },
    isOpen: function() {
      return _opened;
    },
    hasBomb: function() {
      return _field.getMineLocation()[this.getPosition().left + '.' + this.getPosition().top] != undefined;
    },
    setField: function(field) {
      _field = field;
    },
    setId: function(id) {
      _jQueryObject.attr('id', id);
    },
    getPosition: function() {
      return _jQueryObject.position();
    },
    indicateBomb: function(color) {
      _jQueryObject.css({
        background: color != undefined ? color : 'red'
      });
    },
    append: function() {
      $('<div class="' + Settings.getSquareClassName() + '"></div>').appendTo($('#' + Settings.getFieldId()));
      _jQueryObject = $('#' + Settings.getFieldId() + ' .' + Settings.getSquareClassName() + ':last-child');
    },
    hasMine: function() {
      var currentPosition = this.getPosition();
      return typeof _field.getMineLocation()[currentPosition.left + '.' + currentPosition.top] != 'undefined';
    }
  }
}

/*
 * сеет разумное, доброе, вечное
 * seeds the mines on the field
 */
var Seeder = (function () {
  var _field = null;
  function getXRandomizer() {
    return Math.floor(Math.random()*(Settings.getXFieldSize() - 1));
  }
  function getYRandomizer() {
    return Math.floor(Math.random()*(Settings.getYFieldSize() - 1));
  }
  return function() {
    return {
      setField: function(field) {
        _field = field;
      },
      seed: function() {
        var iterationLength = Settings.getBombQuantity();
        for (var i = 0; i < iterationLength; i++) {
          var xRandom = getXRandomizer()*Settings.getSquareSize();
          var yRandom = getYRandomizer()*Settings.getSquareSize();
          if (_field.getMineLocation()[xRandom + '.' + yRandom*Settings.getSquareSize()] != undefined) {
            iterationLength++;
            continue;
          } else {
            _field.getMineLocation()[xRandom + '.' + yRandom] = 1;
          }
        }
        if (Settings.getDebugMode() === true) {
          _field.showMines('#000');
        }
      }
    }
  }
})()

// don't pollute the Object's prototype
Object.size = function(obj) {
    var size = 0;
    var key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        size++;
      }
    }
    
    return size;
};













