var webpack = require('webpack');

module.exports = {
  mode: "development",
  entry: {
    app: './client/app.jsx',
    admin: './client/admin.jsx'
  },
  output: {
    filename: '[name].js',
    path: __dirname + '/public',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/, use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/, use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' }
        ]
      },
      {
        test: /\.scss$/, use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' },
          { loader: 'sass-loader' }
        ]
      },
      { test: /\.woff2?(?:\?.*)?$/, use: 'url-loader?limit=10000&mimetype=application/font-woff' },
      { test: /\.ttf(?:\?.*)?$/, use: 'file-loader' },
      { test: /\.eot(?:\?.*)?$/, use: 'file-loader' },
      { test: /\.svg(?:\?.*)?$/, use: 'file-loader' }
    ]
  },
}
