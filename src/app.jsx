
var exec = require('child_process').exec;

var React = require('react');
var ReactDOM = require('react-dom');
// var Provider = require('react-redux').Provider;
// var connect = require('react-redux').connect;
var Store = require('repatch').Store;

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
    var child = exec(command, {
        cwd: pwd,
        shell: shell,
        detached: true
    });
    var proc = {
        command: command,
        child: child,
        code: null,
        output: '',
        kill() {
            child.kill();
        }
    };

    child.stdout.on('data', (data)=> {
        console.log(`stdout: ${data}`);
        proc.output += data;
        store.dispatch((state)=> state);
    });
    child.stderr.on('data', (data)=> {
        console.log(`stderr: ${data}`);
        proc.output += data;
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
                <div className="form-group">
                    <input className="form-control w-25 d-inline-block"
                        placeholder="shell..."
                        value={this.state.shell}
                        onChange={(evt)=> {
                            this.setState({shell: evt.target.value});
                        }} />
                    <input className="form-control w-75 d-inline-block"
                        placeholder="cwd..."
                        value={this.state.pwd}
                        onChange={(evt)=> {
                            this.setState({pwd: evt.target.value});
                        }} />
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
                return <div key={index} className="my-1 card card-body">
                    <h3 style={{
                            color: proc.code === null ? 'grey' : proc.code ? 'red' : 'green'
                        }}>
                        {proc.command} {proc.code === null ? '...' : proc.code ? proc.code : '\u2713'}
                        {proc.code === null &&
                            <button className="btn close"
                                onClick={()=> {
                                    proc.kill()
                                }}>×</button>
                        }
                    </h3>
                    <pre style={{marginBottom: 0}}>
                        {/*
                        <button>output</button>
                        <button>stdout</button>
                        <button>stderr</button>
                        */}
                        {proc.output}
                    </pre>
                </div>;
            })}
            {this.props.store.getState().procs.length > 0 &&
                <div className="fixed-bottom container py-2">
                    <button className="btn btn-secondary"
                        onClick={()=> {
                            store.dispatch((state)=> {
                                return Object.assign({}, state, {
                                    procs: []
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