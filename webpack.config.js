import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "path";

const dirname = path.dirname(new URL(import.meta.url).pathname);

const config = {
  mode: "development",
  entry: {
    app: ["whatwg-fetch", "./client/app.jsx"],
    admin: ["whatwg-fetch", "./client/admin.jsx"],
  },
  output: {
    filename: "[name]-[contenthash].js",
    path: `${dirname}/public`,
    publicPath: process.env.ROOT_PATH || "/",
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-react"],
          },
        },
      },
      {
        test: /\.css$/,
        use: [{ loader: "style-loader" }, { loader: "css-loader" }],
      },
      {
        test: /\.scss$/,
        use: [
          { loader: "style-loader" },
          { loader: "css-loader" },
          { loader: "sass-loader" },
        ],
      },
      {
        test: /\.woff2?(?:\?.*)?$/,
        use: "url-loader?limit=10000&mimetype=application/font-woff",
      },
      { test: /\.ttf(?:\?.*)?$/, use: "file-loader" },
      { test: /\.eot(?:\?.*)?$/, use: "file-loader" },
      { test: /\.svg(?:\?.*)?$/, use: "file-loader" },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/html/app/index.html",
      filename: "sparql.html",
      chunks: ["app"],
    }),
    new HtmlWebpackPlugin({
      template: "./src/html/admin/index.html",
      filename: "admin/index.html",
      chunks: ["admin"],
    }),
  ],
};

export default config;
