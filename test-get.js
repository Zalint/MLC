// For Node.js, we need to import 'node-fetch' instead of using the browser's fetch API
const fetch = require('node-fetch');

fetch('http://localhost:3000/api/your-endpoint')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error(error));
