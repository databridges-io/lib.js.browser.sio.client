/* eslint-disable quotes */
/*
  DataBridges JavaScript client Library for browsers
  https://www.databridges.io/



  Copyright 2022 Optomate Technologies Private Limited.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/


import babel from 'rollup-plugin-babel';
import {eslint} from 'rollup-plugin-eslint';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import {uglify } from 'rollup-plugin-uglify';
import json from "@rollup/plugin-json";

export default {
  input:'src/dbridges.js',
  output: {
    name: 'dbridges',
    file: 'dist/databridges.sio.lib.min.js',
    format: 'iife',
    sourcemap: true,
  },
  plugins:[

    resolve({
      mainFields: ['jsnext', 'main', 'browser']
    }),
    commonjs(),
    json({
      compact: true,
    }),
    eslint({
      'fix': true,
    }),
    babel({
      exclude: 'node_modules/**',
      babelrc: false,
      plugins: ["@babel/plugin-proposal-class-properties"]
    }),
    uglify(),
  ]

};
