const { Client, MessageEmbed } = require('discord.js')
const client = new Client()

const { TOKEN, PREFIX, SERVER, URL_MONGODB, ERROR, WARN, CHECK, EMBED } = require('./Config.json')

const mongOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false,
  autoIndex: false, 
  poolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000, 
  family: 4 
}

const DataBase = require('mongoose')
DataBase.connect(URL_MONGODB, mongOptions) && DataBase.connection.on("connected", () => console.log(`${CHECK} Base de donnée Mongodb en ligne`)).catch(() => console.log(`${ERROR} Base de donnée Mongodb hors ligne`))

const schema = require('./Schema-Mail')

client.on('ready', () => { console.log(`${CHECK} ${client.user.tag} en ligne`) })

client.on('message', async (message) => {
  if(message.content.startsWith(PREFIX+"open")) {
    const member = message.mentions.members.first()
    if(!member) return message.channel.send(`${WARN} Veuillez mentionner un membre`).then(m => m.delete({ timeout: SERVER.DELETE_MESSAGE_MS}))

    const dataOpen = await schema.findOne({ Guild: SERVER.ID, Member: member.user.id })
    if(dataOpen) return message.channel.send(`${ERROR} Le membre possède déjà un mail, voici son ticket : ${message.guild.channels.cache.find(c => c.name === dataOpen.Member)}`).then(m => m.delete({ timeout: SERVER.DELETE_MESSAGE_MS}))

    member.send(new MessageEmbed() .addField("Ticket créé", `Un staff du serveur \`${message.guild.name}\` vous contacte`) .setAuthor(message.author.tag, message.author.displayAvatarURL({ dynamic: true })) .setColor(EMBED.COLOR) .setFooter(EMBED.FOOTER)).catch(() => {return message.channel.send(`${ERROR} Le membre a désactivé ses messages privés`)})

    client.guilds.cache.get(SERVER.ID).channels.create(message.author.id).then(m => {
      m.updateOverwrite(SERVER.ID, {
        VIEW_CHANNEL: false
      })

      const mailData = new schema({
        Guild: SERVER.ID,
        Member: member.user.id,
        Channel: m.id,
        Transcript: ""
    })
    mailData.save()

    return message.channel.send(`${CHECK} Un mail à été créé avec comme propriétaire \`${member.user.tag}\``).then(m => m.delete({ timeout: SERVER.DELETE_MESSAGE_MS}))
   })
  }

  if(message.content.startsWith(PREFIX + "close")) {
    const dataClose = await schema.findOne({ Guild: SERVER.ID, Member: message.channel.name })
    if(!dataClose) return message.channel.send(`${ERROR} Le salon ${message.channel.name} n'est pas un Mail`).then(m => m.delete({ timeout: SERVER.DELETE_MESSAGE_MS}))
    if(message.channel.name !== dataClose.Member) {
     return message.channel.send(`${ERROR} Le salon ${message.channel.name} n'est pas un Mail`).then(m => m.delete({ timeout: SERVER.DELETE_MESSAGE_MS}))
    } else {
      const embed = new MessageEmbed() .addField("Ticket fermé :", `Votre ticket a été fermé par le staff **${message.author.tag}**`) .setAuthor(message.author.tag, message.author.displayAvatarURL({dynamic: true})) .setColor(EMBED.COLOR) .setFooter(EMBED.FOOTER)
      client.guilds.cache.get(SERVER.ID).channels.cache.get(SERVER.LOGS_TRANSCRIPT).send(`Voici le transcript du ticket :\n\`\`\`${dataClose.Transcript}\`\`\``)
      message.channel.delete()
      schema.findOne({ Guild: SERVER.ID, Member: message.channel.name }, async(err, data) => {
            await client.users.cache.get(dataClose.Member).send(embed)
            await schema.findOneAndDelete({ Guild: SERVER.ID, Member: message.channel.name })
    })
    }
  }
})

client.on('message', async (message) => {
  if(message.author.bot) return
  const dataMember = await schema.findOne({ Guild: SERVER.ID, Member: message.author.id})
  const dataChannel = await schema.findOne({ Guild: SERVER.ID, Channel: message.channel.id})

  if(message.channel.type === "dm") {
   if(!dataMember) {
     client.guilds.cache.get(SERVER.ID).channels.create(message.author.id).then(m => {
       m.updateOverwrite(SERVER.ID, {
         VIEW_CHANNEL: false
       })
 
       const mailData = new schema({
         Guild: SERVER.ID,
         Member: message.author.id,
         Channel: m.id,
         Transcript: `Membre : ${message.author.tag} [${message.author.id}] - ${message.content}`
     })
     mailData.save()

     const embed = new MessageEmbed() .addField("Nouveau message :", message.content ? message.content : `Type : Fichier`) .setAuthor(message.author.tag, message.author.displayAvatarURL({dynamic: true})) .setImage(message.attachments.size > 0 ? message.attachments.first().url : "") .setColor(EMBED.COLOR) .setFooter(EMBED.FOOTER)

     return message.author.send(new MessageEmbed() .addField("Ticket créé", `La team support vous contactera dès que possible.`) .setColor(EMBED.COLOR) .setFooter(EMBED.FOOTER) ) && client.channels.cache.get(m.id).send(embed)
    })
   } else if(dataMember) { 
     const embed = new MessageEmbed() .addField("Nouveau message :", message.content ? message.content : `Type : Fichier`) .setAuthor(message.author.tag, message.author.displayAvatarURL({dynamic: true})) .setImage(message.attachments.size > 0 ? message.attachments.first().url : "") .setColor(EMBED.COLOR) .setFooter(EMBED.FOOTER)
      client.channels.cache.get(dataMember.Channel).send(embed)
      await dataMember.updateOne({ Transcript: dataMember.Transcript === "" ? `Membre : ${message.author.tag} [${message.author.id}] - ${message.content}` : `${dataMember.Transcript}\nMembre : ${message.author.tag} [${message.author.id}] - ${message.content}`})
   }
  } else {
    if(!dataChannel) return
    if(message.channel.id === dataChannel.Channel) {
      if(message.content === PREFIX + "close") return
      const embed = new MessageEmbed() .addField("Nouveau message :", message.content ? message.content : `Type : Fichier`) .setAuthor(message.author.tag, message.author.displayAvatarURL({dynamic: true})) .setImage(message.attachments.size > 0 ? message.attachments.first().url : "") .setColor(EMBED.COLOR) .setFooter(EMBED.FOOTER)
      client.users.cache.get(dataChannel.Member).send(embed)
      await dataChannel.updateOne({ Transcript: dataChannel.Transcript === "" ? `Support : ${message.author.tag} [${message.author.id}] - ${message.content}` : `${dataChannel.Transcript}\nSupport : ${message.author.tag} [${message.author.id}] - ${message.content}`})
      client.users.cache.get(dataChannel.Member).createDM().then(m => {
        m.stopTyping()
      })
    }
  }
})

client.on('typingStart', async (channel, user) => {
  const dataTyping = await schema.findOne({ Guild: SERVER.ID, Member: channel.name})
  if(!dataTyping) return
  if(channel.id === dataTyping.Channel) {
    return client.users.cache.get(dataTyping.Member).createDM().then(m => {
      m.startTyping()
      setTimeout(function() {
       m.stopTyping()
      }, 10000)
    })
  }
})

client.login(TOKEN)
