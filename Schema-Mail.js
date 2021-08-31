const mongoose = require('mongoose')

module.exports = mongoose.model('Mail', new mongoose.Schema({
   Guild: String,
   Member: String,
   Channel: String,
   Transcript: String
}))
