const express =require("express");
const app = express();
const mysql = require("mysql2");
const moment = require("moment");
const session = require("express-session");

const connection = mysql.createConnection({
    host : 'localhost',
    port : 3306,
    user : 'root',
    password : '1111',
    database : 'test'
})

app.set("views", __dirname+"/views");
app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(express.static("public"));

app.use(
    session({
        secret : "dkjflskdjf",
        resave : false,
        saveUninitialized : true,
        maxAge : 3600000,
    })
)

const login =require("./routes/login");
app.use("/login", login);

app.get("/", function(req,res){
    if(!req.session.logged){
        res.redirect("/login")
    }else{
        if(req.session.logged.linkcode == 0){
            res.redirect("/menu");
        }else{
            res.redirect("/search")
        }
    }
})

app.get("/menu",function(req,res){ //관리자가 보는 페이지
    if(!req.session.logged){
        res.redirect("/");
    }else{
        if(req.session.logged.linkcode ==0){
            res.render("index")
        }else{
            res.redirect("/");
        }
    }
    
    /*
        일반유저가 로그인을 하고 url을 쳐서 들어올때 -> search
        로그인을 하지 않은 상태에서 url을 쳐서 들어올때 -> login
    */
})

app.get("/regist", function(req, res){
    res.render("regist")
})

app.post("/regist", function(req,res){ //농장등록
    var _no = req.body._no;
    var _name=req.body._name;
    var _address=req.body._address;
    var _linkcode = req.body._linkcode;
    console.log(_no, _name, _address);
    connection.query(
        `insert into farm(no, name, address, linkcode) values (?,?,?,?)`,
        [_no, _name, _address, _linkcode],
        function(err,result){
            if(err){
                console.log(err);
                res.send("regist SQL insert Error")
            }else{
                var sql =`create table farm_history_`+_no+`(
                    No int auto_increment primary key,
                    temp int not null,
                    hud int not null,
                    date varchar(32) not null,
                    time varchar(32) not null
                )`
                connection.query(
                    sql,
                    function(err2, result2){
                        if(err2){
                            console.log(err2);
                            res.send("regist SQL create table Error")
                        }else{
                            res.redirect("/search")
                        }
                    }
                )
            }
        }
    )
})

app.get("/search", function(req, res){
    var time = moment().format("YYYY-MM-DD HH:mm:ss")
    var sql;
    if(req.session.logged.linkcode == 0){
        sql="select * from farm"
    }else{
        sql="select * from farm where linkcode ="+req.session.logged.linkcode
    }
    connection.query(
        sql,
        function(err,result){
            if(err){
                res.send("search SQL select Error")
            }else{
                res.render("search",{
                    "farm" : result,
                    "time" : time
                })
            }
        }
    ) 
})

app.get("/update", function(req,res){   //값을 보내주는 url
    var time=moment().format("YYYY-MM-DD HH:mm:ss");
    var sql;
    if(req.session.logged){
        if(req.session.logged.linkcode == 0){
            sql="select * from farm"
        }else{
            sql="select * from farm where linkcode ="+req.session.logged.linkcode
        }
        connection.query(
            sql,
            function(err, result){
                if(err){
                    console.log(err);
                    res.json({
                        "farm" : "Error"
                    })
                }else{
                    res.json({
                        "farm" : result,
                        "time" :time
                    })
                    /*
                        서버에서 보내는 데이터의 형식
                        var result = {
                                        "farm" : [{name : moon},{name:test}]
                                        "time" : 2020-02-02 02:02:02
                                    }
    
                        result.time => 2020-02-02 02:02:02
                        result.farm => [{name : moon},{name:test}]
                        result.farm[0] => {name : moon}
                        result.farm[0].name => moon
                    */
                }
            }
        )
    }
})

app.post("/update",function(req,res){
    var No =req.body._no;
    var temp = req.body._temp;
    var hud = req.body._hud;
    var date = moment().format("YYYY-MM-DD");
    var time =moment().format("HH:mm:ss");
    console.log(No, temp, hud, date, time);
    connection.query(
        'update farm set temp=?, hud=?, date=?, time=? where No=? ',
        [temp, hud, date, time, No],
        function(err, result){
            if(err){
                console.log(err);
                res.send("update SQL update Error")
            }else{
                connection.query(
                    `insert into farm_history_`+No+`(temp, hud, date, time) values(?,?,?,?)`,
                    [ temp, hud, date, time],
                    function(err2, result2){
                        if(err2){
                            console.log(err2);
                            res.send("update SQL insert Error")
                        }else{
                            res.send("insert success")
                        }
                    }
                )
            }
        }
    )
})

app.get("/info", function(req,res){
    var farm_no = req.query._farm_no;
    var farm_name= req.query._farm_name;
    console.log(farm_no);
    connection.query(
        `select * from farm_history_`+farm_no+` order by date desc, time desc`,
        function(err, result){
            if(err){
                console.log(err);
                res.send("info SQL select Error")
            }else{
                var temp="";//undefined가 나와서 할당을 해줬다
                var hud="";
                var time="";
                for(var i =0; i<result.length;i++){
                    temp += result[i].temp+","; //string처리
                    hud += result[i].hud+",";
                    time += result[i].date+"/"+result[i].time+","
                }
                console.log(temp);
                console.log(hud);
                console.log(time);
                res.render("info",{
                    "info" : result,
                    "name": farm_name,
                    "farm_no" : farm_no,
                    "time":time,
                    "temp":temp,
                    "hud":hud
                })
            }
        }
    )
})

app.get("/logout", function(req,res){
    req.session.destroy(function(err){
        if(err){
            console.log(err);
            res.send("sesstion destory Error");
        }else{
            res.redirect("/login");
        }
    })
})

app.listen(3000, function(){
    console.log("monitor server start")
})