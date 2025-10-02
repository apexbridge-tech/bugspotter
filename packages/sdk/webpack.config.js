const path = require('path');

module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'bugspotter.min.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      name: 'BugSpotter',
      type: 'umd',
      export: 'BugSpotter',
    },
    globalObject: 'this',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  optimization: {
    minimize: true,
  },
};
