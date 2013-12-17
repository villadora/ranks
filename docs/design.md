

npm, maven, rubygems.org, pypi.python.org


## Similarities

### Impact factor

A journal has a IF 3.0 in 2013, then the papers published in this journal in 2011, 2012 will all receive a score 3.0.


IF = cited_times( paper[2011,2012] ) / uniq_citable_count( allitems[2011, 2012] )


### Page ranks

R(A) = c * sum( B.belongto[pages ref to A] R(B) / num_refs(B))



## Calculation

Ranks:



Rate:

R(P) = if P is tool ? T(P)

Tools rate:

T(P) = if P is tool ? Downloads(P, day) * Rate(day) + Download(P, week * Rate(week) + Download(P, month) * Rate(month) + Download(P, all) * Rate(all) : 0

* Downloads is importance but how importance it should be?

Package rate:

P(P) = sum( [D in dependent(P)], P(D)



