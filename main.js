console.log("Hello, WebGL!")

const canvas = document.getElementById("glCanvas")
canvas.width = window.innerWidth; canvas.height = window.innerHeight
const gl = canvas.getContext("webgl", {antialias: true})
const inp = document.getElementById("inp")
const gen_btn = document.getElementById("gen")
const exp_inp = document.getElementById("exp_inp")
const f = 300.0
const n = 1.0
var zoom = 4.5
var pow = 1.0
var octaves = 3;

// canvas.width  = window.innerWidth;
// canvas.height = window.innerHeight;

var drag_start = [0.0, 0.0]
var drag_end = [0.0, 0.0]
var drag = false
var angles = [Math.PI / 2 + 0.3, -0.16, 0.0]
var prog = 0 
var exp = 0.1
var grid = []

var p = 10
var seed = Math.random()

gen_btn.addEventListener("click", function(){
    seed += 1
    pow = Math.random() * (2.5 - 0.1) + 0.1
    grid = generate_grid(100, octaves)
    gl.bindBuffer(gl.ARRAY_BUFFER, pos_buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(grid), gl.STATIC_DRAW)

    gl.vertexAttribPointer(gl.getAttribLocation(prog, "pos"), 3, gl.FLOAT, false, 24, 0)
    gl.enableVertexAttribArray(0)

    gl.vertexAttribPointer(gl.getAttribLocation(prog, "col"), 3, gl.FLOAT, false, 24, 12)
    gl.enableVertexAttribArray(1)
})

exp_inp.addEventListener("input", function(){
    let alpha = exp_inp.value / 100
    exp = (0.1) * (1 - alpha) + 2 * alpha
})

inp.addEventListener("input", function(){
    let alpha = inp.value / 100
    octaves = Math.floor((1) * (1 - alpha) + 6 * alpha)
    grid = generate_grid(100, octaves)
    gl.bindBuffer(gl.ARRAY_BUFFER, pos_buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(grid), gl.STATIC_DRAW)

    gl.vertexAttribPointer(gl.getAttribLocation(prog, "pos"), 3, gl.FLOAT, false, 24, 0)
    gl.enableVertexAttribArray(0)

    gl.vertexAttribPointer(gl.getAttribLocation(prog, "col"), 3, gl.FLOAT, false, 24, 12)
    gl.enableVertexAttribArray(1)
})

canvas.addEventListener("mousedown", function(event){
    drag_start = [event.pageX - canvas.offsetLeft, 
                 event.pageY - canvas.offsetTop
                ]
    drag = true
})

canvas.addEventListener("mousewheel", function(event){
    if(event.deltaY < 0.0)
        zoom /= 0.9
    else
        zoom *= 0.9
    let projection = [n * (window.innerHeight / window.innerWidth) * zoom, 0.0, 0.0, 0.0, 
        0.0, n * zoom, 0.0, 0.0,
        0.0, 0.0, -(f + n) / (f - n), -1.0,
        0.0, 0.0, -2 * (f * n) / (f - n), 0.0]
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, "projection"), false, new Float32Array(projection))
})

canvas.addEventListener("mousemove", function(event){
    if(drag){
        drag_end = [event.pageX - canvas.offsetLeft, 
                    event.pageY - canvas.offsetTop
                   ]
        delta = [10 * (drag_end[0] - drag_start[0]) / canvas.clientWidth,
                 10 * (drag_end[1] - drag_start[1]) / canvas.clientHeight]
        angles[1] += delta[0]
        angles[0] += delta[1]
        drag_start = drag_end
        gl.uniform3f(gl.getUniformLocation(prog, "angles"), ...angles)
    }
})

document.addEventListener("mouseup", function(){
    drag = false})

const vs_source = `
    attribute vec3 pos;
    attribute vec3 col;
    uniform mat4 projection;
    uniform float zoom;
    uniform vec3 angles;
    varying highp vec3 frag_col;

    mat4 rx = mat4(1.0, 0.0, 0.0, 0.0, 
                   0.0, cos(angles.x), sin(angles.x), 0.0,
                   0.0, -sin(angles.x), cos(angles.x), 0.0,
                   0.0, 0.0, 0.0, 1.0);

    mat4 ry = mat4(cos(angles.y), 0.0, -sin(angles.y), 0.0,
                   0.0, 1.0, 0.0, 0.0,
                   sin(angles.y), 0.0, cos(angles.y), 0.0,
                   0.0, 0.0, 0.0, 1.0);

    void main() {
        vec4 rotated = ry * rx * (vec4(pos, 1.0) - vec4(0.0, 0.0, -150.0, 0.0)) + vec4(0.0, 0.0, -150.0, 0.0);
        float light = clamp(dot(normalize((vec3(-100.0, 0.0, 5.0) - pos)) , normalize(col)), 0.0, 1.0);
        gl_Position = projection * rotated;
        vec3 lc = mix(vec3(0.0, 1.0, 0.0), vec3(0.0, 0.0, 1.0), 0.5);
        frag_col = vec3(0.0, light, 0.0);
    }
`

const fs_source = `
    varying highp vec3 frag_col;

    void main(void) {
        gl_FragColor = vec4(frag_col, 1.0);
    }
`

function create_shader(gl, type){
    var src = type == gl.FRAGMENT_SHADER ? fs_source: vs_source
    var shader = gl.createShader(type)
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    return shader
}

function create_program(){
    var prog = gl.createProgram()
    gl.attachShader(prog, create_shader(gl, gl.FRAGMENT_SHADER))
    gl.attachShader(prog, create_shader(gl, gl.VERTEX_SHADER))
    gl.linkProgram(prog)
    
    var success = gl.getProgramParameter(prog, gl.LINK_STATUS)
    if (!success){
        console.log(gl.getProgramInfoLog(prog))
    }else{
        return prog
    }
}

function mix(a, b, alpha){
    return a * (1.0 - alpha) + b*alpha
}

function glsl_rand(co){
    return Math.sin(seed + co[0]*12.9898 + co[1]*78.233) * 43759.5453 % 1;
}

function noise(st){
    let f = [st[0] % 1, st[1] % 1]
    let i = [Math.floor(st[0]), Math.floor(st[1])]

    let a = glsl_rand(i)
    let b = glsl_rand([i[0] + 1, i[1]])
    let c = glsl_rand([i[0], i[1] + 1])
    let d = glsl_rand([i[0] + 1, i[1] + 1])

    let alpha = [f[0]*f[0]*(3 - 2*f[0]), f[1]*f[1]*(3 - 2*f[1])]

    return mix(mix(a, b, alpha[0]), mix(c, d, alpha[0]), alpha[1])
}

function fbm(st, octaves, pow){
    let acc = 0.0
    let amplitude = 1.0;

    for(let i = 0; i < octaves; i++){
        acc += amplitude * noise(st)
        amplitude *= 0.5
        st = [st[0]*2, st[1]*2]
    }
    // acc = acc / (1 + 0.5 + 0.25)
    return Math.sign(acc) * Math.pow(Math.abs(acc), pow);
}

function calculate_normal(a, b, c){
    let [n, d] = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]])
    return [n[0] / d, n[1] / d, n[2] / d]
}

function get_st(p, grid_res, noise_res){
    let offset = grid_res / 2
    return [noise_res * (p[0] + offset) / grid_res, noise_res * (p[1] + offset) / grid_res]
}

function s(n){
    return [n[0] + Math.random(), n[1] + Math.random(), n[2] + Math.random()]
}

function mix_normals(u, v, alpha){
    return [mix(u[0], v[0], alpha), mix(u[1], v[1], alpha), mix(u[2], v[2], alpha)]
}

function get_smoothed_normal(i, j, l, z){
    let p = [-l + i, -l + j, z]
    let p1 = [-l + i + 1, j, z]
    let p2 = [-l + i + 1, -l + j + 1, z]
    let p3 = [-l + i, -l + j + 1, z]
    let p4 = [-l + i - 1, -l + j, z]
    let p5 = [-l + i - 1, -l + j - 1, z]
    let p6 = [-l + i, -l + j - 1, z]

    let n1 = calculate_normal(p, p1, p2)
    let n2 = calculate_normal(p, p2, p3)
    let n3 = calculate_normal(p, p3, p4)
    let n4 = calculate_normal(p, p4, p5)
    let n5 = calculate_normal(p, p5, p6)
    let n6 = calculate_normal(p, p6, p1)

    let normals = [n1, n2, n3, n4, n5, n6]
    let nx = (normals.map((el) => el[0]).reduce((s, el) => s + el)) / 6
    let ny = (normals.map((el) => el[1]).reduce((s, el) => s + el)) / 6
    let nz = (normals.map((el) => el[2]).reduce((s, el) => s + el)) / 6

    return [nx, ny, nz]
    
}

function calc_color(lowest, highest){

}

function generate_grid(grid_cnt, octaves){
    grid = []
    let noise_res = 8
    let z = -150
    let l = grid_cnt / 2
    for(let i = 0; i < grid_cnt; i++){
        for(let j = 0; j < grid_cnt; j++){
            let flip = (i + j) % 2 == 0
            let chance = Math.random()
            let sw = [-l + i, -l + j, z]
            sw[2] += fbm(get_st(sw, grid_cnt, noise_res), octaves, pow) * 7

            let se = [-l + i + 1, -l + j, z]
            se[2] += fbm(get_st(se, grid_cnt, noise_res), octaves, pow) * 7

            let ne = [-l + i + 1, -l + j + 1, z]
            ne[2] += fbm(get_st(ne, grid_cnt, noise_res), octaves, pow) * 7

            let nw = [-l + i, -l + j + 1, z]
            nw[2] += fbm(get_st(nw, grid_cnt, noise_res), octaves, pow) * 7
            
            let n1 = calculate_normal(sw, se, flip ? ne: nw)
            let n2 = calculate_normal(flip? sw: se, ne, nw)
            grid.push(...sw, ...n1, ...se, ...n1, ...(flip ?ne: nw), ...n1,
                      ...(flip ? sw: se), ...n2, ...ne, ...n2, ...nw, ...n2)
        }
    }

    return grid
}

function get_torus_xyz(phi, theta, R, r){
    x = (R + r*Math.cos(theta))*Math.cos(phi) + 1
    y = (R + r*Math.cos(theta))*Math.sin(phi) + 1
    z = -r*Math.sin(theta) - 3
    return [x, y, z] 
}

function cross(u, v){
    let x = u[1] * v[2] - v[1] * u[2]
    let y = v[0] * u[2] - u[0] * v[2]
    let z = u[0] * v[1] - v[0] * u[1]
    return [[x, y, z], Math.sqrt(x*x + y*y + z*z)]
}

function generate_torus(precision){
    let phi= []; let theta = []; for(let i = 0; i < precision; i++){phi.push((2*Math.PI)*(i/precision)); theta.push((2*Math.PI)*(i/precision))}
    phi.push(0.0); theta.push(0.0)
    let torus = []
    for (let i = 0; i < precision; i++){
        for (let j = 0; j < precision; j++){
            p1 = get_torus_xyz(phi[i], theta[j], 1.5, 0.5)
            p2 = get_torus_xyz(phi[i + 1], theta[j], 1.5, 0.5)
            p3 = get_torus_xyz(phi[i + 1], theta[j + 1], 1.5, 0.5)
            p4 = get_torus_xyz(phi[i], theta[j + 1], 1.5, 0.5)
            let [n1, d1] = cross([p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]], 
                            [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]])
            let col1 = [Math.abs(n1[0]) / d1, Math.abs(n1[1]) / d1, Math.abs(n1[2]) / d1]
            let [n2, d2] = cross([p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]], 
                [p4[0] - p1[0], p4[1] - p1[1], p4[2] - p1[2]])
            let col2 = [Math.abs(n2[0]) / d2, Math.abs(n2[1]) / d2, Math.abs(n1[2]) / d2]
            torus.push(...p1, ...col1, ...p2, ...col1, ...p3, ...col1, 
                       ...p4, ...col2, ...p1, ...col2, ...p3, ...col2)
        }
    }
    return torus
}

const vertices = [
    1.0, 0.0, -1.0,//xy
    1.0, 0.0, 0.0, //rgb

    0.0, 1.0, -1.0,
    0.0, 1.0, 0.0, 

    0.0, 0.0, -1.1,
    0.0, 0.0, 1.0
]

gl.enable(gl.DEPTH_TEST)


var projection = [n * (window.innerHeight / window.innerWidth) * zoom, 0.0, 0.0, 0.0, 
                  0.0, n * zoom, 0.0, 0.0,
                  0.0, 0.0, -(f + n) / (f - n), -1.0,
                  0.0, 0.0, -2 * (f * n) / (f - n), 0.0]

prog = create_program()
gl.useProgram(prog)
gl.uniformMatrix4fv(gl.getUniformLocation(prog, "projection"), false, new Float32Array(projection))
gl.uniform3f(gl.getUniformLocation(prog, "angles"), ...angles)

var pos_buffer = gl.createBuffer()
p = 100
var torus = generate_torus(p)
grid = generate_grid(100, octaves)
gl.bindBuffer(gl.ARRAY_BUFFER, pos_buffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(grid), gl.STATIC_DRAW)

gl.vertexAttribPointer(gl.getAttribLocation(prog, "pos"), 3, gl.FLOAT, false, 24, 0)
gl.enableVertexAttribArray(0)

gl.vertexAttribPointer(gl.getAttribLocation(prog, "col"), 3, gl.FLOAT, false, 24, 12)
gl.enableVertexAttribArray(1)


function draw(){
    gl.clearColor(28 / 256, 28 / 256, 28 / 256, 1.0)
    gl.clearDepth(1.0)
    // gl.depthFunc(gl.LEQUAL)
    // gl.poygonMode()
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    // gl.drawArrays(gl.TRIANGLES, 0, 70*70*6)
    gl.drawArrays(gl.TRIANGLES, 0, 100*100*6)
    window.requestAnimationFrame(draw)
}

window.requestAnimationFrame(draw)