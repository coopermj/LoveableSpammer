#!/bin/sh

#name = ""
#filename = ""

if [ "$1" != "" ]; then
    #echo "Positional parameter 1 equals $1"
    name=$1
    filename=$1
#else
    #echo "Positional parameter 1 is empty"
fi

if [ "$2" != "" ]; then
    # echo "Positional parameter 2 equals $2"
    fname=$1
    lname=$2
    fnlen=${#fname}
    lnlen=${#lname}
    nlen=$(($fnlen+$lnlen))
    # echo $nlen

    if [ $nlen -gt 20 ]; then
    	fname=$1
        # echo "was greater"
    else
    	name="$fname $lname"
    	filename="$1_$2"
    fi
    # echo $name
# else
#     echo "Positional parameter 2 is empty"
fi

outfile="hookout/$filename.png" 
labelfile="hookout/label-$filename.mpc"

convert  -fill '#ff4040' -background transparent -quality 20 \
          -font Christopherhand -pointsize 144 label:"Remind $name of \nthe Power of Subliminal\nMessaging" \
          -trim +repage -depth 32 -blur 2x2 \
          $labelfile

convert $labelfile +distort Perspective '0,0 0,0 0,905 -41,905 436,0 453,0 436,905 400,919' $labelfile
convert $labelfile -geometry 630x630 $labelfile


if [ -f $outfile ]
then 
    rm $outfile
fi 

composite -geometry +1290+260 -compose Multiply $labelfile wb.png $outfile 
composite cutout.png $outfile $outfile

convert $outfile -resize 600x600\> $outfile

echo $outfile

if [ -f $labelfile ]
then 
    rm $labelfile
fi 


