
var exec = require('child_process').exec;

var React = require('react');
var ReactDOM = require('react-dom');
var pty = require('pty.js');
var Terminal = require('xterm');
var Store = require('repatch').Store;

const DEFAULT_ANSI_COLORS = [
  // dark:
  '#2e3436',
  '#cc0000',
  '#4e9a06',
  '#c4a000',
  '#3465a4',
  '#75507b',
  '#06989a',
  '#d3d7cf',
  // bright:
  '#555753',
  '#ef2929',
  '#8ae234',
  '#fce94f',
  '#729fcf',
  '#ad7fa8',
  '#34e2e2',
  '#eeeeec'
];

var initialState = localStorage.getItem('state');
if(initialState) {
    try {
        initialState = Object.assign(JSON.parse(initialState), {procs: []});
    } catch(e) {
        initialState = null;
    }
}

if(!initialState) {
    initialState = {
        shell: '/bin/bash',
        pwd: process.env['HOME'],
        procs: [],
        history: []
    };
}

const store = new Store(initialState);

store.subscribe(()=> {
    var state = Object.assign({}, store.getState());
    delete state.procs;
    localStorage.setItem('state', JSON.stringify(state));
});
var KEY_UP = 38;
var KEY_DOWN = 40;

function run(command, pwd, shell) {
    var elem = document.createElement('div');
    var term = new Terminal({
      cols: 80,
      rows: 24,
      screenKeys: true
    });
    term.open(elem, false);

    var commandTokens = command.split(' ');
    var child = pty.spawn(commandTokens.shift(), commandTokens, {
        cols: 80,
        rows: 30,
        cwd: pwd,
        env: process.env
    });

    var proc = {
        command: command,
        child: child,
        term: term,
        code: null,
        get output() {
            var content = '';
            this.term.buffer.lines.forEach((row)=> {
                var prevStyle = '';
                
                line = row.map((c)=> {
                    let bg = c[0] & 0x1ff;
                    let fg = (c[0] >> 9) & 0x1ff;
                    let style = '';
                    let tag = '';

                    ch = c[1];
                    if (ch == '<') {
                        ch = '&lt;';
                    }
                    if (ch == '>') {
                        ch = '&gt;';
                    } 
                    if (ch == '&') {
                        ch = '&amp;';
                    }

                    if (fg && fg < 256) {
                        style += `color: ${DEFAULT_ANSI_COLORS[fg]};`;
                    }
                    if (bg && bg < 256) {
                        style += `background-color: ${DEFAULT_ANSI_COLORS[bg]};`;
                    }
                    if (prevStyle && style != prevStyle) {
                        prevStyle = style;
                        tag += '</span>';
                    }
                    if (style && style != prevStyle) {
                        prevStyle = style;
                        tag += `<span style="${style}">`;
                    }
                    return tag + ch;
                }).join('');
                if (prevStyle) {
                    line += '</span>';
                }


                content += line + '\n';
            });
            while (content && content.endsWith('\n')) {
                content = content.slice(0, -1);
            }
            return content;
        },
        kill() {
            child.kill();
        },
        get running() {
            return this.code === null;
        }
    };

    child.stdout.on('data', (data)=> {
        term.write(data);
    });

    term.on('refresh', ()=> {
        store.dispatch((state)=> state);
    });

    child.on('exit', (code)=> {
        console.log(`done: ${code}`);
        proc.code = code === null ? '?' : code;
        store.dispatch((state)=> state);
    });

    store.dispatch((state)=> {
        var history = state.history;
        if (proc.command !== state.history[0]) {
            history = [].concat([proc.command], state.history);
        }
        return {
            pwd: pwd,
            shell: shell,
            procs: [].concat([proc], state.procs),
            history: history
        }
    })
}

class Provider extends React.Component {
    componentWillMount() {
        this.props.store.subscribe(()=> {
            this.forceUpdate();
        });
    }
    render() {
        return <div>
            {React.Children.map(this.props.children, (child)=> {
                return React.cloneElement(child, {
                    store: this.props.store
                });
            })}
        </div>;
    }
}

class Main extends React.Component {
    constructor() {
        super();
        this.state = {
            shell: initialState.shell,
            command: initialState.history[0] || '',
            historyIndex: 0,
            pwd: initialState.pwd
        };
    }
    render() {
        return <div className="container py-4">
            <form onSubmit={(evt)=> {
                evt.preventDefault();
                run(this.state.command, this.state.pwd, this.state.shell);
                this.setState({historyIndex: 0});
            }}>
                <div className="form-group form-row row">
                    <div className="col-3">
                        <input className="form-control"
                            placeholder="shell..."
                            value={this.state.shell}
                            onChange={(evt)=> {
                                this.setState({shell: evt.target.value});
                            }} />
                    </div>
                    <div className="col-9">
                        <input className="form-control"
                            placeholder="cwd..."
                            value={this.state.pwd}
                            onChange={(evt)=> {
                                this.setState({pwd: evt.target.value});
                            }} />
                    </div>
                </div>
                <div className="form-group">
                    <input className="form-control"
                        placeholder="command..."
                        value={this.state.command}
                        onKeyDown={(evt)=> {
                            if (evt.keyCode == KEY_UP) {
                                this.prevCommand();
                            }
                            if (evt.keyCode == KEY_DOWN) {
                                this.nextCommand();
                            }
                        }}
                        onChange={(evt)=> {
                            this.setState({command: evt.target.value, historyIndex: 0});
                        }} />
                </div>
                <div className="form-group clearfix">
                    <button className="btn btn-primary float-right" type="submit">run</button>
                </div>
            </form>
            {this.props.store.getState().procs.map((proc, index)=> {
                var color = proc.running ? 'muted' : proc.code ? 'danger' : 'success';
                var exitCode = proc.running ? '...' : proc.code ? proc.code : '\u2713';

                return <div key={index} className="my-1 card card-body">
                    <h3 className={`text-${color}`}>
                        {proc.command} {exitCode}
                        {proc.code === null &&
                            <button className="btn close"
                                onClick={()=> {
                                    proc.kill()
                                }}>×</button>
                        }
                    </h3>
                    <pre
                        dangerouslySetInnerHTML={{__html: proc.output}} 
                        style={{marginBottom: 0}}></pre>
                </div>;
            })}
            {this.props.store.getState().procs.length > 0 &&
                <div className="fixed-bottom container py-2">
                    <button className="btn btn-secondary"
                        onClick={()=> {
                            store.dispatch((state)=> {
                                return Object.assign({}, state, {
                                    procs: state.procs.filter((proc)=> proc.running)
                                });
                            })
                        }}>clear</button>
                </div>
            }
        </div>;
    }
    prevCommand() {
        var index = this.state.historyIndex + 1;
        var command = this.props.store.getState().history[index];
        if (command) {
            this.setState({
                command: command,
                historyIndex: index
            });
        }
    }
    nextCommand() {
        var index = this.state.historyIndex - 1;
        var command = this.props.store.getState().history[index];
        if (command) {
            this.setState({
                command: command,
                historyIndex: index
            });
        }
    }
}

// Main = connect()(Main)

// procs.subscribe(() => console.log(procs.getState()));


ReactDOM.render(<Provider store={store}>
    <Main />
</Provider>, document.getElementById('main'));