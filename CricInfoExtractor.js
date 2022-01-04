// npm init
// npm install minimist
// npm install axios
// npm install excel4node
// npm install pdf-lib
// node CricInfoExtractor.js --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results --excel=worldcup.csv --dataFolder=worldCup2019

let minimist = require('minimist')
let axios = require('axios')
let excel4node = require('excel4node')
let pfdlib = require('pdf-lib')
let jsdom = require('jsdom')
let fs = require('fs')
let path = require('path')

let args = minimist(process.argv);   
 
let responceKaPromise = axios.get(args.source)
responceKaPromise.then(function(responce){
    let html = responce.data;  // data processing part
    
    let dom = new jsdom.JSDOM(html)

    let document = dom.window.document;

    let matches = [];

    let matchScoreDiv = document.querySelectorAll("div.match-score-block");

    for(let i = 0; i < matchScoreDiv.length; i++){
        let match = {
        };

        let nameps = matchScoreDiv[i].querySelectorAll("div.name-detail > p.name");
        match.t1 = nameps[0].textContent;
        match.t2 = nameps[1].textContent;

        let scoreSpan = matchScoreDiv[i].querySelectorAll("div.score-detail > span.score");
       
        if(scoreSpan.length == 2){
            match.t1s = scoreSpan[0].textContent;
            match.t2s = scoreSpan[1].textContent;

        }else if(scoreSpan.length == 1){
            if(scoreSpan[0].textContent == undefined){
                match.t2s = scoreSpan[1].textContent
            }else{
                match.t2s = scoreSpan[0].textContent;
            }
        }else{
            match.t1s = ""
            match.t1s = ""
        }

        let spanResult = matchScoreDiv[i].querySelector("div.status-text > span")
        match.result = spanResult.textContent; 

        matches.push(match);
       
        let matchesJson = JSON.stringify(matches);
        fs.writeFileSync("matches.json",matchesJson,"utf-8");      

    }

    let teams = []

    for(let i = 0; i< matches.length; i++){
        createTeamsfromMatches(teams,matches[i].t1);
        createTeamsfromMatches(teams,matches[i].t2);
    }
    
    for(let i = 0; i< matches.length; i++){
        insertParticularMathesInTeams(matches[i].t1,matches[i].t2,matches[i].result,matches[i].t1s,matches[i].t2s,teams);
        insertParticularMathesInTeams(matches[i].t2,matches[i].t1,matches[i].result,matches[i].t2s,matches[i].t1s,teams);

    }
    
    let teamsJson = JSON.stringify(teams);
    fs.writeFileSync("teams.json",teamsJson,"utf-8");

    createExcelFiles(teams)
    createFoldersAndPDF(teams)
    

}).catch(function(error){
    console.log(error);
})


function createTeamsfromMatches(teams,teamName){
    let tidx = -1;
    for(let i = 0; i<teams.length; i++){
        if(teams[i].name == teamName){
            tidx = i;
            break;
        }
    }

    if(tidx == -1){
        teams.push({
            name : teamName,
            matches : []
        })
    }

}

function insertParticularMathesInTeams(selfName,oppName,result,selfScore,oppScore,teams){
    let tidx = -1;
    for(let i = 0; i<teams.length; i++){
        if(teams[i].name == selfName){
            tidx = i;
            break;
        }
    }

   let team = teams[tidx];

   team.matches.push({
       vs : oppName,
       selfScore : selfScore,
       oppScore : oppScore,
       result: result
   })

}

function createFoldersAndPDF(teams){
    if (fs.existsSync(args.dataFolder) == false){
        fs.mkdirSync(args.dataFolder);
    } 
  
    for(let i = 0; i<teams.length; i++){
        let teamMatch = path.join(args.dataFolder , teams[i].name);
        if (fs.existsSync(teamMatch) == false){
            fs.mkdirSync(teamMatch);
        } 

        for(let j = 0; j<teams[i].matches.length; j++){
            let matchFileName = path.join(teamMatch, teams[i].matches[j].vs + ".pdf");
            createPdf(teams[i].name,teams[i].matches[j],matchFileName)
        }

    }

}

function createPdf(teamName,matches,matchFileName){

    let tName = teamName || "";
    let oppName = matches.vs || "";
    let selfScore = matches.selfScore || "";
    let oppScore = matches.oppScore ||  "";
    let result = matches.result || "";

    let pdfBytesTemplate = fs.readFileSync("template.pdf");
    let pdfDocKaPromise = pfdlib.PDFDocument.load(pdfBytesTemplate);
    pdfDocKaPromise.then(function(pdfDoc){
        let page = pdfDoc.getPage(0);

        page.drawText(tName,{
            x : 255,
            y : 665,
            size : 15
        })

        page.drawText(oppName,{
            x : 255,
            y : 635,
            size : 15
        })

        page.drawText(selfScore,{
            x : 255,
            y : 605,
            size : 15
        })

        page.drawText(oppScore,{
            x : 255,
            y : 578,
            size : 15
        })

        page.drawText(result,{
            x : 255,
            y : 555,
            size : 15
        })

        let finalPdfBytesKaPromise = pdfDoc.save();
        finalPdfBytesKaPromise.then(function(finalBytes){
            fs.writeFileSync(matchFileName, finalBytes);
        })
    
    })
}

function createExcelFiles(teams){
    let wb = new excel4node.Workbook();

    let myStyle = wb.createStyle({
        font: {
          bold: true,
          color: "red",
        },
      });

    for(let i = 0; i< teams.length; i++){
        let ws = wb.addWorksheet(teams[i].name);
        ws.cell(1, 1).string("VS").style(myStyle);
        ws.cell(1,2).string("Self-Score").style(myStyle);
        ws.cell(1,3).string("Opp-Score").style(myStyle);
        ws.cell(1,4).string("Result").style(myStyle);

        for(let j = 0; j<teams[i].matches.length;j++){
            ws.cell(j+2, 1).string(teams[i].matches[j].vs || "");
            ws.cell(j+2,2).string(teams[i].matches[j].selfScore || "");
            ws.cell(j+2,3).string(teams[i].matches[j].oppScore || "");
            ws.cell(j+2,4).string(teams[i].matches[j].result || "");
        }
    }

    wb.write(args.excel);
}
