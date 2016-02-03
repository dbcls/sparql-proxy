module.exports = {
  entry: './client/main.jsx',
  output: {
    filename: 'app.js',
    path: 'public/assets',
  },
  module: {
    loaders: [
      { test: /\.jsx?$/, loader: 'babel', query: {presets: ['react', 'es2015']} },
      { test: /\.css$/, loader: 'style-loader!css-loader' },
      { test: /\.scss$/, loader: 'style-loader!css-loader!sass-loader' },
      { test: /\.woff2?(?:\?.*)?$/, loader: 'url-loader?limit=10000&mimetype=application/font-woff' },
      { test: /\.ttf(?:\?.*)?$/, loader: 'file-loader' },
      { test: /\.eot(?:\?.*)?$/, loader: 'file-loader' },
      { test: /\.svg(?:\?.*)?$/, loader: 'file-loader' }
    ]
  }
}
