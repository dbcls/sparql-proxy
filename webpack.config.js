module.exports = {
  entry: './client/main.jsx',
  output: {
    filename: 'app.js',
    path: 'public/assets',
  },
  module: {
    loaders: [
      { test: /\.jsx?$/, loader: 'babel', query: {presets: ['react', 'es2015']} }
    ]
  }
}
