const path = require('path');

module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'bugspotter.min.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      name: 'BugSpotter',
      type: 'umd',
      export: 'BugSpotter', // Export the BugSpotter class directly as the global
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
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.build.json',
          },
        },
        exclude: [/node_modules/, /tests/, /\.test\.ts$/, /\.spec\.ts$/],
      },
    ],
  },
  optimization: {
    minimize: true,
  },
};
