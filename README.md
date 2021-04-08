toio-exec
---
[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)

A simple example of mutual exclusion (i.e., collision avoidance) for the [toio](https://toio.io/) robots in grids.
It is written in Node.js with [yarn](https://yarnpkg.com/) build and tested on MacOS 10.15.

- This repository is used in a paper ["Offline Time-Independent Multi-Agent Path Planning"](https://kei18.github.io/otimapp) (OITMAPP).
- This repository is forked from [toio.js](https://github.com/toio/toio.js). To make the repo private temporarily, I duplicate the original repo.

## Demo
![toio](./material/sample.gif)

## Install
```sh
> git clone https://github.com/Kei18/toio-exec.git
> cd toio-exec
> yarn install
> yarn build
```

## Usage
1. Switch on your toio robots
2. Get the id of the toio robots
```sh
> yarn run get_id 3
xxxxx
yyyyy
zzzzz
```
3. Edit the id in the plan file (`./sample/plan.json`)
4. Set the toio robots in appropriate positions
5. Execute
```sh
yarn run app ./sample/plan.json ./sample/grid.json
```

## Licence
This software is released under the MIT License, see [LICENCE.txt](LICENCE.txt).

## Author
[Keisuke Okumura](https://kei18.github.io) is a Ph.D. student at the Tokyo Institute of Technology, interested in controlling multiple moving agents.
