const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const app = express()
app.use(express.json())
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server is running at http://localhost:3000')
    })
  } catch (error) {
    console.log(`DB Error:${error.message}`)
  }
}

initializeDbAndServer()
//API 1
app.post('/user/', async (request, response) => {
  const {username, name, password, gender, location} = request.body
  const hashedPassword = await bcrypt.hash(password, 10)
  const getUserQuery = `SELECT * FROM user WHERE username='${username}'`
  const dbUser = await db.get(getUserQuery)
  if (dbUser === undefined) {
    const createUserQuery = `INSERT INTO (username,name,password,gender,location) VALUES ('${username}','${name}','${hashedPassword}','${gender}','${location}')`
    const dbResponse = await db.run(createUserQuery)
    const newUserId = dbResponse.lastID
    response.send('User Created Succesfully')
  } else {
    response.send('User Already Exists')
    response.status(400)
  }
})

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'jsjwhjxjsjwidjw')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'jsjwhjxjsjwidjw', async (error, user) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//API 2
app.get('/states/', authenticateToken, async (request, response) => {
  const getStates = `SELECT * FROM state`
  const getAllStates = await db.all(getStates)
  response.send(
    getAllStates.map(eachItem => ({
      stateId: eachItem.state_id,
      stateName: eachItem.state_name,
      population: eachItem.population,
    })),
  )
})

// API 3
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getState = `SELECT * FROM state WHERE state_id=${stateId}`
  const getOneState = await db.get(getState)
  response.send({
    stateId: getOneState.state_id,
    stateName: getOneState.state_name,
    population: getOneState.population,
  })
})

//API 4
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths) values ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})`
  const postNewQuery = await db.run(postQuery)
  response.send('District Successfully Added')
})

// API 5
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrict = `SELECT * FROM district WHERE district_id=${districtId}`
    const getOneDistrict = await db.get(getDistrict)
    response.send({
      districtId: getOneDistrict.district_id,
      districtName: getOneDistrict.district_name,
      stateId: getOneDistrict.state_id,
      cases: getOneDistrict.cases,
      cured: getOneDistrict.cured,
      active: getOneDistrict.active,
      deaths: getOneDistrict.deaths,
    })
  },
)

// API 6
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQuery = `DELETE FROM district WHERE district_id=${districtId}`
    await db.get(deleteQuery)
    response.send('District Removed')
  },
)
//API 7
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtName, stateId, cases, cured, active, deaths} = request.params
    const {districtId} = request.params
    const updateQuery = `UPDATE district SET district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} WHERE district_id=${districtId}`
    await db.run(updateQuery)
    response.send('District Details Updated')
  },
)
//API 8
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatesStatsQuery = `SELECT SUM(cases),
  SUM(cured),SUM(active),SUM(deaths) FROM district WHERE state_id=${stateId}`
    const stats = await db.get(getStatesStatsQuery)
    console.log(stats)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)

module.exports = app
