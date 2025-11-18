var content = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const DOWNLOAD_ICON_SVG_RAW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <g stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 21H18" />
    <path d="M12 3V17" />
    <path d="M12 17L17 12" />
    <path d="M12 17L7 12" />
  </g>
</svg>`;
  const SUCCESS_ICON_SVG_RAW = `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<rect width="160" height="160" fill="url(#pattern0_1_2484)"/>
<defs>
<pattern id="pattern0_1_2484" patternContentUnits="objectBoundingBox" width="1" height="1">
<use xlink:href="#image0_1_2484" transform="scale(0.00625)"/>
</pattern>
<image id="image0_1_2484" width="160" height="160" preserveAspectRatio="none" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAYAAACLz2ctAAAgAElEQVR4Ae2dCXhV5bX310nISMh4hiSoV2trhcoDaul3awv6VavX1tT2FrVe+/W297b3Xu0Vej+10esU5lEIQxJmEIhlkDlkngdCEiSMAiKzRfBW8GurFWv9f8//3ftNNjFIhn1OTsLez7NyjJycvd/1/+213rX2u/cRCcSWIeHygu8GyfDdIy95ngzJcGe7MtybXBm+SleGd4crw7vTNdbX5MpoY/x/jnXfB+35lT5XvqcG7k3URF70jJaXvN81tJLwQKDhv308G5cgL3nvC3nZM971sqfAleE96Rrr/YtrnA+u8aZN8MI1wQfXxMvYJB9cjnXfB5fzL31PDbQe1Gas92Ol1cueAmpHDYVa9prtxaThQugyPE2usd6LrvGEzAvXRC9ck71wTfHBNdW0aT64tE33waVthg+utqb/zXlt9dMX+aKt//i79f3a73zVelAbakStFJheAnmRWlJTobZBu73ku1syvKtkrPd9Ge+FTPRCJnshU7yQaT7IdB9khg/yig8y0weZlQzJTIbM9kFm89W0OckQx/znA+1n9eozNKAW1ITaUCNqRc2oHTWkltSU2lJjah0024ueWyXDs1zGej+UCTxgHrg5gBkcmAYtGTI3GTIvBZKVAslOgeSkQOa3sQUpkLa2MBXiWOd90NaP/L2tv6kDjZpQG2pEOBkcqB01VDD6DG2pMbWm5tS+x7YMT4y87HlWxnreMcBjpPMaZxDPJg6CkSwruRW0hSmQRSmQJSmQpbRUyLJUyHKrDYS86phffLB84KW+pu+pAbWgJtSGGhFSBgdqRw2pJTVldKTGjIoKRM87ioHfugcElkOSP9ZTKOM9xsEo8LyQWT7IHJ8JXbIRyRabsC1LgbyaClmRClmZAlnpg6z0QFYmQVYmQFbGG7YqAeKY/3yg/Ex/0+h7akAtUgxtqBG1IpTUjlEzxwwk1JYazzCDDUEkA2QhYNEww/0TGec5ruYFUxnxNHjJkGwTOhXlzKhG4HIHQnKTIbluSG4C5Hdu9Ft3DeI23Yxr8m7HVwu/jSHF/xvDSr7jWAB8MKT4Lny14FvK99SAWlATpY3SiFoNNIBkdlqSakRHwkiNGRU1iGSAc0QyQTb8uo31PiPjPR+qEMyox7Cs0ywPjmcMwzqhWzUQ8juaF/K7RMg6Hzxbb8Hw8vvxUOO/47/2vYxxhzIx8+2FmHd8OeafWIWFJ3MdC4AP6Gv6nL6nBtTi4cb/UNpQI2qlNFPaDTS0pKbUVkdFnZ7JgE7LZIOM+GXLcI+VCR6jMmLUy/RC5vmM8MyIx5DN8L0q1QBvjQ+yJgGRm67HbeXfxb80/19MOjIXC0+uwvJ31ipbeno1Fp1+DQtPrcICxwLqg4WnVynfUwOlx+m1ShtqRK2oGbWjhkItGUyoLTWm1tScqZkMkAUywaqZjJAVW7e28LF1kuWDLEg2Jq+vpljAS1EHHbHpOtxR/QCePjAW2SdfxdJ3VoODzjq5DHNPLsEc2qklmHtqqWM96ANqQC2oCbWhRtSKmlE7akgtDRBTLCCahQsZIAtkwi8QjnM/LRM9EOb6V7yQ2V5jHsBqiZNVTl5fS4WsHQhZ64Ws92BQ2QiM3v+iGsTC0yvVAGedXIhWW4RZJxdh1inHgsIH1EJZq0aEktoRRGpJTamt0phaU3NqTwbIAueGZIOMqHkhixP3U90LhBmeUTLR/ZFM9RgfPMcLyfFBFiVDljPqpUBWp0LWpUJeT0T/rdfjwcZ/xoxjOcg59SpmnliA6SdyMP1kDmbQTl3GTudghmOB98Hl9DhpaEbtqCG1pKbUlhpTa6U5tScDZIFMkA0yoiD0QLEz1vNQ1yAc5x0qE9ynWuCba8K3OBnyKqskplqClwJZn4iUoiF4fF+6CuUzT+RgyvG5mHJiLqactNipuZhitdNzMaXF5mHKaccC5wOL762a8L+tmlHD43NBTZmmqTG1lvUJhvZkgCyQCbJBCMlKK4SnhSx1amOTeYKnWKa6ITO9BtXzfcYOuKPXUiBrUyEbUiAbE3Fj+f/Cbw+Nx6yTCzDpeCYmHJ+FCScyMeGkxU5lYkJbO52JCVZr++/O75/3mR0+sfqc/93eZ1q1o5bHZyltqfFvD43Dl8q/obRXDJAFMqEhJCuMhGSHDJElMtXhbXxSukxxX5p2WyIf53smfJsS8ZWKv8ezhydg2ol5yDg2HRnHpyPjhGknZyBD26kZyHCs9/hA68ZXrSe1PTZdaU3Nqb1sSjQCEZnIZZVsiYQ6HZOlCUnPdoy/cb4hMsl9TmZ4zIKjTeTjfG9jKmRTEq4rvx1PHc7AxOOz8PzRyXjh2GS8cHwyXjgxpdVOTsELVjvV5nf9b/z/jgXOB9rv1tf2tLFqSW2PTVZaU3NqTwbIgmKCbFgjYTarY7ZoPFBMka0v3DIkRMZ7XpVpHqO3w/JaFRzmnI+UbxwI2exGYvEg/PuBZ9QZkf72eKQfHY/0Y6Ydn4B0bScmIF3byQlIp+nfndfg8kV7+mgd+ar1pdZvj1fakwGyQCYUGyoSsjBJNtghQ+wTkimyRcYuu03wjJQp7o9kpgcyzwtZ4IMs80FWJUPWpEA2pEI2exFecA1+3PyvePHtyXjqyEt46u2X8NTRl/DUsZcNO/4SnnKs7/lA60utqfmRlxQDZIFMkA3FCFkhM2SHDJElMkW2yFi7G8mc5F4lM9yQ2R7IfC9kCS9SJ0NWs9JNgWxJgeS58Y0d9+OZIxkY89bzGH3kOYx++zmMPvrfhh37b4x2rO/6QOtMzY88pxggC2SCbChGyAqZITtkiCyRKbJFxtqNghPdt8kU9wWZ5YbM80AW+SDLfZDXkiHrUiCbUiBb3fCW34JfvfkbjH7rOTx++Gk8/tYzePzIM3j8bYsdfQaPO9b3fGDVmJpT+8NPKxbIBNkgI4oVMkN2yBBZIlNki4yRtc9tk5ImynQ3ZI4HkuOBLGXq5fXcZKPK2eJDSH4y7tk5Cv956Lf45cEx+OXh3+CXb5l25Df4pWNXjw+07mTg4BjFBNkgI7LFZzBDdsgQWSJTZIuMkbVLtslxCTI1sVlmuiFZjH5eyKtcxeKDvJ4M2Wyk3msqh+Hn+3+NX7z5n/jZwSfws8MWe+sJ/Myxq8cHVu0PPqGYIBtkRKViMkN2yBBZIlNki4yRNTLXsk1OvFemJ30is92Q+Yx+Xsgqr7EKYmMyZKsPrgIfRjalqR09euBXePTgv+HRQ6Yd/jc86tjV5wOtP1k48CvFBhkhK2RGyA5X0pAlMkW2yNj0pL8KmWvZpiSNl1eSjDy90HNp9GPhsc2NxPKb8aM9P8MjB/4Vow78HKMO/sKwQ7/AKMeuXh9oDg78XLFBRsgKmVEFiTUKki3OBckamVPbAgmTaUnFkpkEyfZAlnCJto5+PkheMiTfjUHbv4WH9v0cD+57DA8eoP0UD775Uzx40LGr2gdkgCyQiX2PKUbICplR7GxkHcFuCrsqHoMxskbmyJ5Mj7tBpieekrluyAI3ZJkH8poX8roPsjkZss2L0OJU3NF0P36w959w/76Hcf/+R3D/Acd60gffO/AI/GVdGheZ2PewYoSskBmyoxgiS2SKbJExskbmyJ5MS7xXZiZ+IlluyCI3ZIUbspoNReZxI/rFld+I7+x6EPft+THu2fsj3LPvH3HPfsd60gd3H/gh7jyUZpuNPJSGb7/5fdy1/wf4ble0JRN7f6QYIStkRkVBMkSWyBTZImNkjcyRPZmW9KRkJkJykiBL3JBVHsgaL2SjF5LngxQmIbX6Fnyn+Qe4a3ca7tyThjv3puHOfY71hA/u2peGkfsfwJ17H8AD9Y8greYneKD2EaR1wx6oeRjfq3kIDzX8HD/a938wcv/3O68vmdiTphghK2SG7CiGyBKZIltkjKyRObIn05OyZHYiZH4iZBnvjPJAXvdCNnmNEFrkwQ11t2Pkru/hjub7cMfu+3DHnvtwx17HesYH/4DbDtyFx6p+hZzFOchalIPspdnIXsrXzlvWkmzkLFuA1zetR93OevzH/v/CrXvv7Ly+ZIJsNN+HO3d9TzEjRR6DIbJEpsgWGSNrZG5GwjyRVxI2ypxEyMJEyHK3cXsel15v8ULyPZBiH26q/wa+ueu7GL7rbgxvvhvDd9+N4Xsc6wkfDN07EnfsuhcL8hdjZ3kTDuw+gMP7DuHQvoNdtEM4+fZJfPbB31DwXglu23MXbt19Z+f1JRNkY9fdihUyQ3YUQ2SJTPHWTzJG1sgc2ZOZCRUyLxGyKAmyIgmy2gPZ4IFs9UIKPAgtTcZXd3wDt79xF4btGolhzSMxbLdjPeGDobtH4it7h+PXVU+huXYXLrx/HnZt5z+7gB8e/ilufOM2DNt9Z9c0Jhu7RipWyAzZIUOKJTJFtsgYWSNzZE9mxtVLFgFMNAF0Qza4IVs9kAI3+pWm4Cv1X8eQpm/hazu/ia+98U18bZdjPeGDG5tvxR077sP60g04c/T3+PTTT+3iDzN+Pw8DGwdj8K6/77q+ZGPnNxUrZIbskCHFEplazSKXACZCMUf2ZGZik2QlQJYkGo9qWMN1XR5IngdSaAB4w/ZbcXPjN3BT03DctHM4bnrDsUD74Mtv3I5r3xiC58pexqHGN/GnP/3JNvh2/3kfhjR/G9c23dI9bclG03DFCplRABayH+gxmCJbfBwIWSNzZE8y45skmwDymSxJkLVJxgpXLq0hgGXJuG77EHy58TZ8qfFWfKnpVnxpp2OB9oF311dxV+0DKCkvwbnT5/C3v/3NFgA/+ewT/MuRJxG/44bu60o2Gm9VrJAZskOG1LVhrpomW2SMrJE5sqd+5CRAliZCcjWAbuNSShEB9CG1bhCu2zEE1zbcgmsbb1FnCs8WxwLjg5SmQUhpHISpJa/g2O6j+Oijj2yBjx+y7g+b4W74MpIbb+6+nmSj4RbFCpkhO1JksrTJbQBIxsgamTMAjGuSnHjIsgRILu/3TDQiIK/lFSUhtNwLT+1NSK0fhJQdNyOl4WakNDoWOB8MQv+ma/D9yodRX1WP98+9j8/wmS0AnvvkPdyx9x8QvT0VqY2EvJu6ko0dNytWyAzZIUPqujAjINkiY2SNzGXGMQLGNcl8E8DXEo2bjvlmAlhsAJhUeyO89TfBU/8VeBocC6QPYhv/Dqn1g7GgeDFOHzyFixcv2gIfPyTj1FT0q/OoCGjbmOq/olghMwrAYguAvKGdjBFAMndZADcnGZdRipMQUuZBXO3fIbH+S0iovwEJDY4FygfxDdcjtMGDx8p+ib11e3Dh/AXb4Gv6U7NK6xHbk+3VtP4GxQqZITsMYuqSHJm6PIBxkGXxkNd4t3siZHMiJD9J/bGrzI3+Ndcgtu5aDNh+LQbUOxYYH1yH0AY3rq8einUlr+Pdo2fw10//aguALDx+fPCfITUxiK2/zl5Nt1+rWCEzZMcAMMlgSgGYYLA2P05HwNgmydEAxkPWJUA2JUC2JUKKEuEqS0JkVSqiawciqm4gorY75m8fRG8fiIjtKZDtCXiy+Gm81XjY1rbLqvfWIaw2EWF1XnBfto6nbqBihcyQHTKkWCJTZOs1TvfioZjLjOUcMLZJSCP/Z247AJYmIrzSh4iaZETUJiOizjF/+yC8LhlSH4NbKr6J4rISvGdj2+XMxbMYsusOSHWUgtz2sZCRmmTFjKvUCGKXAEjGyJqKgArAAU0yPxayLA6SGwdZFw/ZFA/ZlgApSoCrNAGhlW70q/GgX61HTVo5cXXMfz4I2Z6AfrUJGFc0CSf2HLe17fLsibGQqn4IqXP7R0MyUuNRzJAdMqRYIlNki4yRNTKXOYARkAAOgCyLNQGMg2yKg2yLhxTFQ0rj4apMhKs6Ca7aJLjqHPOrD2qTINvDMLLsPtRX7bC17dLwxybE1w9U0S/EXzqSEbJSmajYUQyRJTK1zgxyZI3MdRRAqUiAVCVAahIgtY751Qd10Yip8iKnaAHeOfgOPrap7XLxbxeR9ubDkAqB1Cb6T0cyQlbITKkZxK4IYM4XR0AHwECddPGQulCMKn4Me+v24oPzH9hS9fJDVpx7DSHVEary9esJ1FEAyVxLBFQADoDkxkLWxZopOA5SFAcpjYNUxEOq4iE18ZBax/zjgwRIXTiSK2/EmpJ1OHvsXdvaLmcuvovBb9wOqXSZkc+PGpIRskJmyA4Z2mZO68gWGVs2APJ5AGMguQMg6waYAMZCimIhpbGQijhIVRykJg5S65j9PiAQAyC1YXii6Dc40vSWrW2X9OMvGqm3Jtb/+pERskJmyA4Z2mYGNbJFxpbFWAHs3yQ5MZClJoBrB0A2xkLyYiGFsZCSWEh5HKQyDlJtQsidOGavD2pDMKjsNrPt8p5tq11U4VHng1SFGxnM37qREbJCZsgOGSJLZIpsEUCyRuYy+7MKdgDs8ZOpNhqh1f0xtmgCTuw5YVvb5eJnF5F24CFIudh7snwRxF0DsL8ZAWMga2MgGwdA8gZACgeYETAWUhkLqY6FMIw7Zq8PagUjSr+LHTa3XVacy0UII191lL3H+0X6kxGyUm5mTzJElsgU2co1s21Of2sEdADssZOqNhwxVUnILlqA39vYdlGFx85bzbkfp0wBChydBzC6SXKiIUv7Q3L7Q9b2h2yMgeTFQApjICUDIOUDIJUDINUDIDWO2eeDGEitYFTxo9i73d62S/rxF8zU2z+wmpERskJmyA4ZIktkimyRMbJG5jKjOQeMapKcKMjSaEhutAlgf0hef0hhf0hJDKQ8BlIZA6mOMfpINc4rV5J0z1j1hiC54nqz7XLWtrZLwx8bEV/nhVSFmvB191g78fdkhKyQGbJDhsjSRjO4kTGyRubInmRGmgBGQXKjTACjIXnRkMJoSEl/SHl/SGV/SDXPJse67wMKynmZC08UjcaRnfa1XVThsf/HlugXYL3ICFkhM2SHDJGljWZwI2NLo0wAI00As6MgS6Igq6Iga8w3b42GFERDivtDyvpDKvpDqkwIuRPHuueDGsGg0qEoLivGe6fta7usOJuLkMowo+3SExqREbJCZsgOGSJLBJBskTGyRuYY/NQPB8DuwdRZoWvCEVoVgbFF421tu6jCo2moEf06e0x2vb9rAEZClkSaETAKsjEKsjUKUhAFKY6GlEVDKqIhVdGQase67YMawYiS72BHtb2rXdKPPQ8pE0h1ZM/pREbICpkhO2SILJGpNWaWJWvZkdYISAAjHAADcXLVhCKmMh7ZRfNtbbuowqPWDalw9Rx89F+HAIxoC2CECWAkZE0kZGMkZGukGQGjIGVRkIooSFWU0dRkY9OxLviAkYltl0dsbbuowmPfj8zo18PakBGyQmaKzSxKlsgU2VplBrvsCDMCzgpvkqxwyOIIyMoIyOoIyIYIyJYISH4kpCgSUhoJKY+EVEZCqhzrmg8IhiC57FqsKVmLs8fsa7usOLsSIRX9IJX9el4fMkJWyAzZIUNkiUyRLTJG1sgc2VM/HAADIFw4pErwROGTtrZdzlw8g8GNQ4zoFwzBofMAhpkRMByyMhyyOhyyIdyMgBGQoghIaQSkPAJSGQGpcqxLPqhm22WI7W2X9KPPmfCx9RIE2pARskJmyE6+mU3JFNkiY4vDzQgYxgjYHoBhDoB2ilkdgtDKMIwtHGdr20UVHjVJxvVeO4+3O591WQDDvgjAMMjiMMhKvikMsoEAhkPywyFF4ZDScEh5OKSSacSxzvkgTM39RhTfZetqF6Pw+CGkVCBVZuM5GLQhI2SFzJAdMkSWyBTZImNkLSsMKvjJrH5NktUPsrgfZGU/yOp+JoBhkPwwSFEYpDQMUh4GUR12DtaxDvugWhBTEWu0XQ7Zd5ORUXiEQipDgksPMkJWyAzZIUNbzKBGtsgYWSNzZM8B0J8nUz+j7VL0kK1tF6PwuMUy9/PnGDr52Z0GcGZok2SFQBaHQFaEQlaHQtaHQjaHQraFQgpDISWhkLJQSAXPOMc67IMqQXJpKtYU29t2ST/6rJF6Gf2CTQ8yQlbIDNkhQ2SJTJEtMkbWyBzZUz8+B2AIZHMIZFsIpDAEUhICKQuBVHDAjl3ZBzxJXZBKwRMFv8aRnUdsu8mo4f81IL46wbjeq+ALMj3ICFkhM2SHDJGl9SEdAZBvMt/sANi9k61KMKhksNF2ecee1S7q5vK9P4CUSPeOzZ9B5AsBZJY1s21rBHQ1SZYLstgFWeGCrHZB1rsgm12QbS5IoQtS4oKUuYzrjOrM5tndUaOzeIHcZqvi53b0GAL9PkFoRajtbZcVZ1cgpJyZKIjHzmvRZIXMkB0yRJbIFNkiY2SNzM10MQVLk2QJZLFAVghktUDWC2SzQLYJpFCMM46rLNTATaAIVQcsqioa8WXxCC8KR0RxJCJLohBVEqVe+d+dNf5tVAlXXLD90LFj6Mhx2vqeKsGIopG2tl1U4dEw2Jz7Bem4yQN1ISuM0mSHDJElMkW2yBhZI3Nkz68AVgiurb0WS5qWYEneEry8/GU8v/h5017A84s7by8segHjFozHfa/fZ0TVYIOwShBTFoPswhz83sa2S/rR9OCHLxgBDC0LxbMHnwXOQz1sZ9+OfWiubcbuLhr/tqmoCWvWrcXNRYOMKNiFyGxrxNOZwDyOUYWjbG27GIVHvBFZ9L6C9bXTEfAVaZJ5AlkkkFcF8juBvN4mBRebYZU3OHMHnbEyQXRlNPIv5KsH7fD57n/99FN1Aw4fOdtZ47cD/fGPf8SRN97GtK3TEcWFj/rM68xx+eO9lYLkkhRbV7uoKx570yDUwB/HbPdnkhGmYB6vNQWTKbJFxsgamSN76oc/AeQASwTDGofh7CdnbXva0/k/nEdzVTN+su3R4AGwwv62y4p3VyCEbY2unPx2w9WRzwtKAHlQxYIxb42xDUBGzjPHziCvMA+DmIp7OgpWCgYVD0JxeTHes6ntogqPHYONCX1HxA+G9wQlgHRMmSCyIhJ5f8izDcIPP/oQx5qPYVpez6fi0HL72y6q8OgtqVfDH7QA8gB1Kr5oXyp+/w/vt6Zi7YQeeB1RNMLWtosqPPicPa526YHxdHmfXQJwrkAWCmS5QF4TyDqBbBJInkAKBFIkhiM4ueQOumNFfkzFhYMMsbpzfF3425jSGGQX2dd2UYXHnjTD7104nm7p0939kRGeNGSG7JAhskSmyBYZI2tkrqUICSSApYLIcj+lYlbFpWaTuruO7MTfjyqwt+2iCo9SXlPt5sneiTHYBm3QA0inFAuGNQzDWX+k4rxHAxcFKwTJxSm2rnZRhUf9YKON0RMAdXefvQJAHqS/UnFBHgYFMBXbvdol/e10I331xuhHeHsFgDzQEkFkWSTy/scPVbFOxdoh3T2rL/P3bP/Y2XZp+KAB8ZXxRtvlMvu0LVX66/M7DeB0aZI5AllgThBzBbJWIBsFslUg+ZYFCZxccgd2WaFg6I6h/knFWx81iiW7jrXN54SWhmJsgX03GanCY3eacfWgzb5s83cgPpeM6IUIZIcMkSUyRbZYhJA1Mkf21I+eApAHWygYc9gPDWqm4oJBfoNwRKG9bRdVeHARp90neSCgs+6jVwHIAy8WRJb6MRVz6RbTjdVJ3fzvmBJ7V7uowmP74Na5XzePz86xdvqzeh2AdHYvS8V2t11U4cEL9709+lHLXgkgD7qXpGLVdrHx2S6q8OC3CukVR705+vVaAHngrIp7QSq2s+2i7vHoC4WH9aTplRFQD4CpuN6PVbHeTxdf2V9Uj9S1abXLijMrEFLMO8jsnaN2et7WRX+0u58uAzhfIMsEskogawSyQSBbzDX9vKbHFEFHcQf+Mn5+gZ+rYjq7C8cfWmK2Xfba801GZz4+g8EsPOjbLhxP0P4NNSQrHBfvByFDZIlMkS0yRtY+14YJBgApRJEgssSPVbF65HDnRR9RMMLWR+qmH0k3RPL3SR1ouHs9gHRYQQBScSeEiSm2t+2iCo9yfplz50+EoI182p99AkAOIohS8ah8+1a7tFzx6Gupt08ByMH4ORVHF0Ubc68rpMDkQntXu6jCoyjEmCdp0frSa6cj4DRpktnmxHCpQFaaE0Z9czoXFPKaHtOFLkS4k0BYvmDodj9UxdXNeJTXiq80hmLBE/n2PdtFXfGoG2z480r77q3/TkbICpkhO/qmdBYhZIuMsd4gc2RP/QhWADmYfMGYQ364VsybmbYNao2C7QjOa8l2tl1U4UFhAn0itzO2K558Xf2bPgUgnVAoiCz2T1U8fet0XJKKLU4PLQrF2PxxOGFT26Wl8NCPOrHsy28w9MQ++hyAdGIPpOIR+fatdlGFR3Na3069GvY+CSAHtU0w5qB/UvFgnYq5nxJBTKG9bRdVePBZeZwbaaH66muXAMwUSI5AlliekMVHKfBuJi4o1E/J0oUIdxJoKxBEFkUi7z37V1BP32KmYkJRLBi1zb62i7riUTvY8GGgfdYT+yMj+pEcZIcMkSX9ZCwyRtbIXEsR0hsApDO3CYbWDcXZj+28r/g8dvERH5t/oqKTJ9+LNUVrbPsmo/S30g34evLkDSSIfRpADs4fqfj4u9iwbQO+vPHL+Onmn+JQ42FbHqmrCo+yeOOSWyAh6Ml99WkA6Vh/pOIPP8Th/YeRW5yLwpoinDvT/UfqqsJjV9rVk3o19H0eQA5Up2Kb7iv+7LPP8Oc//xnn3z2PC/9zAR9f/Ljbz69RhUeBWXhoca6G104DOFWaZJZAsi1FCJ/jxkcp8G4mLqfRj+jg5JI7CAbbam9VTOI+A59e2P2tpfCg34LBV4E8BjLC69wcO9khQ2SJTPHxvCxCyBqZI3vqR28EMF8QWWhvVdx99IxPSD+cbggQTCdsoCC8agCkQ/PMqtimVGwHgKrwKI03ms6BEj2Y9nNVAcjB+iEVdxVEVXi8kWZEv2CCIpDHclUBSMcGUSpe8fsVCMnnNwRdhSX16u0AAAlESURBVHM/DXmnAZwiTTLT/N4Gfn8DHyKtH8/BtfxcTsMJJVdxcHLJHQSbbRUMrbW3Qd3ZKKgKj5rBxpWjYPNPII+HjFiXYpEh/VgOstX6HSEQsqd+9HYAOegtgjFv2netuLMAqsKDVV+wnqSBgvCqBJDO3dZzVbEqPErijaZzoIQO1v10C0D9XSG9LQVrMbYIhtbYu4L6SpFQ3Vy+M83oeenjuJpfrwQgGTO+pstMwZPMOSC/K0Q/J1rfG8xl+dYVMXoeyJ0Eo/H4Ngc2Fa94ZwVC+JWkwe6bQOlFP3D1lF4JQ4b0PcH6+dBkjdM+sqd+8Je+ACCdnCeIzA9Mg1oVHtWDjegXKIGDfT9XPYAUKECpOP1QutElcKJfa0Z0ADTbAH5OxarwKI43WlTBHpUCeXwOgK0Xw/2Vii8pPAIpbm/YlwOgpUDaLBhabX+DWhUeW0OMyXZvgCKQx9glAF8xv7mGVbB+QhbX8HMtv3VJFqsb7qC3GI93k2DMAfsa1KrwqBrcOvfrLb4I1HHS59alWPp+EP1krNZvSbJUwX0VQDp9qyByWyTyztlzM5MqPNia6m0nowNgD0ZOm1Jxw4UGxBfFGz2uQAna2/bjRMB2QLchFavCoynNSb1XOiEcANsBkE5jKmaDuoup+JLC40oiXM3/3iUAZ5iPTLU+JZVFiL4vhEuy9A3qvdm5mwRDqzpfFavCo9IpPDpUfBJAskJm9P0gZEkXIfrxvGROXYqbKPUy3QKgfkQbbyLhOi6u5+KkW9+cxB30VmN1tlEwZn/nquL0g+mGM/n3vXXsgTpuXQGTGb0WkCxZH81mPB8aQvZkklRcAiDvWuKb+yKAFGGLIDKv46lYFR6F8cYJGCgRe/N+vghAsqUjIIMe2ZOJsvFzAPL2ub4KIMXVqfgKNzO1FB5MJb0ZikAe++UA1LdkWgEkezJR5sk084mV1gcU8evVmYL1kiymYD0PDOSA/LEvOqkDqVgVHltC+s64/eHLtp9JRsgKUzDZIUNkSQNIxoynozIFZ4mMlydlqvm0It4wzAWDXLfFRalcx6WvhnBSqeeBFLC322ZB5NZI5J1tv0GtCo+Kwa1zv94+3kAdPxnRBQjZIUP6a1rJFhnjw7DIHNmT8XKvTJVP1J3qXKmqAWTVYr0c19cApCAbBUMr26+KVeHBSTTP6ECJ1xf20xZAXQEzqOnV0MZTET5R7Ml4uUGmyqmWO+Osq6J1K8ZaCfclQTiWDYLR+0dfsvK+4XwD4gvijTO5L0ARqDFY0y+ZYRvPCiDZ0svxyRzZkwUSJpOkWHg9WK+Kti5I4Ie0nQcGakCB2I+Ziree3aogVIVHY5rRQgjE/vvSPqwAkhkrgGSKAJIxskbmMiRc1DZJxgsbg3PNr1Nv2wvsywASgI2CYZXD8MEnH2D9mfUI2WwWHn0JjkCMpS2ALECsPcAFJmNGE3q8AR9/TpZ7Zbr8teX7QnjzMKsWayXMVgTngdxJIAYTyH1wTJsFj+16DF+v/rpRwQVy/31lX6YfeUJ/rgImU2zBsAIma2SuZZssCTJVmi9biDCUtp0H9kUQ+2KhFQi4yQJNt1/am/9dWoA0C5m7ZJskE1VuZhomqexat42C/GAtEnemd9xXXvvimAKhDf1GIxtkpL3+H5kiW8b8b+Il7KlfJsptMk0uqBDJZqH1OTG6H8gP16nYEavvnYBdhVXDRzbIiLX/p58H09qAviBk7XNbhoTIVFnVkoZZsbBysV4XJtl9PQp2VYSr9e8uF/108aGrX7ZfjP7fKiFr7W5TZKTMkI/Ut1m3TcOMgnou6ERBJ/rpE65t9CMjZMV6+Y0scQUM2SJjl91I5jR5td0oqCtihldGQV7rY87Xc0J9QM7r1QGnBo/666VXZENf+2XmbBv9yNZlo5+mcooMkRlyThGr54K8jKIvzekFCoyCOhJaQdQh2Xk1JuZ90Q9ab75qDnThYb3ywTqCDBnR75yQrQ5tUyVdRUF2rdk81I1pRkGdirlD7rxtJOyLDnfGdOnJpAGk9mSALFhTr158SnbIkDH3S+8Qe+pNGRIj06S4pSJmD6dtQaJTsQPhpeL0dVjbwqerXutVD7JCZlorX152i+k4gHznFBkqM+W06t1wEslwqlOxXqxqLUqcSNj3QWwPPjKg4eM0jYzoqx7s+5EhstSlbZo8JJnyF7WCQadi/Qxp5nruuC2EDoh9D0QreDrtMvJp+MgC1/yRDU7XyArbLmSHDHVrmy7PqFTMhYTsDXIHvELCHWoIrenYScl9C0ArfNSWZk27Gj4yQTbICFnhNd9X5OlusdfyxzNkbIcg1I1qDaETDXsvjFbwrFGPGut2yxfBR2Zs3dqDkCGXeZ9zQlbHTMk8uPZAtMLIwXGyrgfpvPasL9pqQa206YhnBY9aU3Nqr9OuNfLZDp8meaZKxx+2zAm5YIGTTpbdbNHwoHRa5vyAB61hZNjWkVG/6kE6r62C95QvtCYaOOql9bPO9agxtabm1J4M6DnfbPlQyIhft5nyE5ktx1sgZMXDsptzAJ4RGkQdEXnwOipaYdRAcsCO9awPqIU2DR010+DpiEdtqTG1pubUvhW+40I2ArK9IrdKphSqJiN7Pez5cALKM6ItiIyIVhg1kFYo9aCd19aoE0hfUAsNnBU6aqcjngaPGlNr3edjo5kskImAblNlgGTKszJX3lFVD88EnhFtQWS1rKOihpFAaig5b9TtHA7escD4QPudr1oPvlqho3ZtwdNRj5UutScDZKHHtllym8yW5TJXPlSdb05GNYgM05ykMipyzsABWYHk2aWNA3cscD7QftevDBJaH2pFzagdNWRQoabUlhmPWlNzah8022y5W+bIKpkn77dERIZpTlI5AA2jFUgOlGdYW9OOcF5bobDDF239zN+pgRU4K3TUjhoyuzHiUVtqTK2DdsuU4TJHxsscaZRs+VidMRyAjow8k6xQck7R1ugEx+z3QVs/83cd4agJtdGRjpox2lFDaklNqW2v2WZJvMyRe9WBz5MCmScnJUv+ogbFa8scoDbCaTWedY7Z7wOrj/nf2v98pSYELks+VlpRMyOQ3CvUsldvvAF5rtwgc+QemSOjZY5kyxzZJHOlUubJDsmSnZIlTY4F1Ac7le+pAbUwNKE29yqtWm4a9y95/x+YFT9wd0eh8QAAAABJRU5ErkJggg=="/>
</defs>
</svg>`;
  const ERROR_ICON_SVG_RAW = `<svg fill="none" height="160" viewBox="0 0 160 160" width="160" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <pattern id="a" height="1" patternContentUnits="objectBoundingBox" width="1">
    <image height="160" preserveAspectRatio="none" transform="scale(.00625)" width="160" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAYAAACLz2ctAAAM9UlEQVR4Ae3dS4/b1hUH8DNAooXbjWUggFcBsklWQWbVIkBiLQIj48kgCJBvUffh1gujXdQpxuO+P0K76Bco8i26SGp30XebAEVrJ3Ycv8b2zDi+xZ/DP03RQ5GU7iXPkc4AxB1RFHnvOT9eXlISJZLwb39j45tfvffehTCZPJdwM77qBBFAzpA75DDB6tOvMpw+/cpXGxtXH585Ew7efvty+i36FmJGADlD7pBD5DLmupOvaw/4Njc/Onj11XBw8mR4/MYb4WBz81LyDfsGokQAucpydvJkQA6RS+Q0yspTrwQVPQC+9fWwPxqFfZGwf+JEOJhMHGHq4EdYP/AhV8hZlrvRKCCXyKl6hGV8B8QHgCLhYDx2hBGApFwF8SFXGT7mzgLCWfjYGEeYks9i667DV+ROM8I2+IqGeE+4mJQEr27CV+ROI0Li2y+P+fKumxV/pnSECRjNt0ri268cdp/JGXOKoZWWMWEZ395oFPZEWk9osJ+YzIcm1qvK+LrkDrkeHOEi+IrGOsJYljqvh/j2xuPWnUaRN3Q0QyKMgo+9pSPsjGfRFyyMj7kbAmFUfGyII1zUVOvXR8PH3PWJMAm+vCE+JmxtaO4FiQ+xnjqcEtO8ZR8Iq/gezVvZmtdl6/OecG5cTS8kPoz5kuQuJULg28dbMevr4dFolDUAjUgxIUD7k0nY8/eOm0y1fh6xzGKa40uRt2yduBKCy3Ex37brE18RGEfYGlfTgsT3KDU+dkgxEQ6Cjw1xhE22Gp/vHR9zFwMh8eGCY+rDbtHzsQF56YfjRmO1CxAfx3x1MU42Px8TznU4Jr4+xnyNAfCesBZZ3RPE19tht9JxFDmdpycEvr38hOPhaBQeigw+IZB7fmJS521qPvAhVoiZhtzBEDqyzFTTh1qJ79H6etCCj0F0hFPOjnygDh87L1w5aUKoGZ8jPNLb1Ey1+Nog3Nvayg67Gns+4mPpPeGUu+yBenxHIdzaOvyOSXjzzdfDmTNXnrz2mrrDLtFVS0f4FKEZfCWEsAZzsCcfHj/+ww9PnAifPP98CPlCD7iw5hIXVlf8xAT4EIOHWk44ZnihKRiDNZiDPbko8vXvilz+tUj4VGQKIV6keULgswSs4Nt2D0v4NOeIdcNRDPhgDNZgDvbYl6+dF9lxhAyH7tI6PlgTkbVqlB1hNSIKHy8rPoa6QPiJH44ZEzWlVXywhKNrXc9XDfAUwif5OHBX+XgwG2tgMI5B+RKOCdEmtO3BeKx6XI480ArsdMVHjBnCX4mEf4uEMkKsXPOEBC0bwjI+zbFn3YAQZmAHhtr2fMTH0hEyEgOWq4qPITeN0PolGuBDG9Crs3fRXMbq+YiPZe2YUHMwsroZPhyz59s1hm/eMR+x1ZVTPeFX+TjwvkjQPiGB1saEZXza44v6YWeHiUXHfHX4OH/t+yI7PDGxhvCBkbNj4ENdseNYxAcjR11kJqJFS0e4aARnvN7xzQhO6SnTCLUejq0fdlP3fCV/2b8Fwn/lx3+MAywcMu7jQq6ywzF7PtTNQgw55kPuMSTrGx8xTiF8nAO8JxK0T0S4q+AdE9QBOwTqpD1uqB92EOR6aHxTCH8pEv6ZVwwVNBFIXN7AYH9AhNg26mANH3KNnA/V8xEfy+ISDfYKaz3hUAit4mPPN+/ba0QTuzSNMLvs0WNPaP2wqw0fMWcILR6O7+UnJn0cjokP2zQxVMmPajzsasVXIMS4gAgP8vHgXZGgfeoDYRmf9nigfthBkEPi0zLmI7a6Mjs7/oVI+EfeADTERMAT9oRW8SGHyKUVfESZIfSe8DAcVvFZ6/mIj6UjFJHdzc1tnOTgEG/iKGD0sEt01dI0wkUv0QAf1mENHw67mq7zVVF1fVwgRMPwCzzoCe4YmO4ucLGa+LAOE23Nc2N1zNeEMkPIE5NlR2gV39+NnnA04ePzK4HQ8THdOsulRmgV37Iedut2AdMI79d8gAH48JyP+erSrmt+gRDjDvxqDwbqtw1Md/CZPZzZlt47vrexkeHDcybakMd82cd8TeQzhD8XCRYR3jt1Kuy+//6PMeF/i/gQe2vvcDSh6vq8aYS777wTMDm+rmnXtbxdhMeOhTvHjpk77HrP9+wOUCD8m7ExoaUxH2Lr+J7FxzlTCPFjJ0julz4tFAPEELF0fGQ2u3SEEXc4xzcbW92zjjACQsdXx6vdfEe4AELH1w5Z01IFwr/m4xgE1seEs2NAfIiZn3A0EWt+fu17Ijs/EwkIKG71D4C3fDoyBogNYoRYIWaIXcobBTWnbzmWcIQtdjjHlxa7I5yB0PGlxce1O8IjEDo+8uindIQlhI6vH3TVrRQI/5L/dglOSr5YsQltxk3BEQM/4agSSf94pRE6vvTA2mxhJRE6vjY0+ltmpRA6vv5gddnSSiB0fF1I9L9sgfDP+e9W4KTk5hKcmLANuC8z2vZTf4ejf10tt5ghRIKqCJFEqxN2JMfXUoCCxZYKoeNTIGqOKkwhxE3TeTi21Auizqi7H3bnEKDgJWvfEtn5QCT8Mf/OsSV8qCu+J426ow1oi3+qRYGqrlW4OBr95PciT5BQS70g64q6ow1d2+3LK4nAtVOnPrj+4otPPhcJN4xNqDPqjjYoCadXo0sEdre2tnffeivcfuEFc/i4s6DuaMPuu+9e6tJ2X3bgCNze3Nz+cjIJN8djs/iIEG1AW26X7kUzcHh987MisEz4HOGsTCt8DvhuL0nPR3ws0ROibd4TKoSHKpV7PosnHYRWV6JNfjhWju/GeByQqGWe0EYfEyqCyJ5vFfBxx3KESgCuIj5HqAgfBuWr1PMRH0u03U9MBgDJng+DciZjVUs/MekZIPDdmkzC5+Nx+EzEJ5x0jccBMfFLNIkxOr76Hc4ROr7Be2NHmAih93z1PV91GOIIIyN0fO3xEaMjjITQ8XXH5wgj4bu1ubn9RX62ex0fzvSpcwzQEyKGt/yjXN1UEt9n43HnoDvU6Z0VMXSEHfw5vmlAMXYoR9gSoOOLj4+AHWEDQov4+FVPJll76QhrEFrDhzNNfHXy03zC/5inHSDq5wgrCC3iw29xXM3vTIq7k+J/zHOEleRqf1jGd00kaJ/QgwDan0TCjkg4K3IRE/7HPDyHZbS3A/Vb+Z7QKj70dpdEwncOb5eR7eP4H/PYExpEuK29s4paP8v40Nvl+NZKQVnDPDznCEtR0fjvEuJjmB0hI6G1XGJ8DLkjZCS0lSuAjyF3hIyElnKF8DHkjpCRGLq0iA8/gVU52y2fcLQNaYaQZ8dYp58dtw1dpOWI79p4HP4non7C9THi2z68zrfonUnXzorsYF0AjXVjGyZi8fRTNDYv0QDfzckkXDeG74pIiISPu3GBEOu2hBC5Qw6RSzbGRGkZHw6Z6LUi35M5Q4h1O8LEhB1fbYAdYW1oIj3h+BoD6QgbQzTnAo6vdeAcYetQtVzQ8bUM1NPFHOHTWCz2n+ObO36OcO7Q5S+0iA8/e4oz0URnu11DOoUQdbNynXDwSzQ38+t8uMj8XxH1Ey7+KsNHrM8gRF0txBS5x3VCWGBjeimxwRuTSbCED9/bwG+vRb7IHCveGULUDXVEXS0hhIXeEFrEx55PKT4iLhBiiIA6O0KGJi8dXyUg8R86wrqYOr66yESf7wirIXV81Ygkf+wIGWLHx0j0XjpCx9c7uuoGVxeh46taGOzx6iF0fINhq9vw6iB0fHUGBp+//Agd3+DImiqwvAgdX1Pu1Ty/XAjD6dNf293auoSferL03q6Rt9dSqTWNENZgDvbk45deuvDxyy+H/xw/nt3fTvunMMqfalH+3m4qfFyvSYS4hyKswRzsyY9EXj8ncuW3eEIk4CfjtSJ0fLRXlKYQwhaMwRrMwV7WkrMir3xb5KPfKEbo+Ap01X9MICQ+GIM1mJtqyA8UI3R8U6k66oFqhFV8sHZUI0QjQsd3ZKqOmqkSYWt8bJEmhI6PWWldqkLYGR+bqQGh42M2OpcqEM6Nj80dEqHjYxbmLgdFuDA+NnsIhI6P0V+4HARhNHxsfp8IHR+jHq3sFWF0fAxDHwgdH6MdvewFYTJ8DEdKhI6PUU5WJkWYHB/DkgKh42N0k5dJEPaGj+GJidDxMaq9lVER9o6PYYqB0PExmr2XURAOho/hWgSh42MUBysXQjg4PoZtHoSOj9EbvJwLoRp8DF8XhI6PUVNTdkKoDh/D2Aah42O01JWtEKrFx3DOQuj4GCW15UyE6vExrHUIV/wLRAyP9nIKIW6Sia9mmMHH6FYR3tV9Z1JW28vDCBQIcadW5A7f4eDH6JFbE4Eiwt+JhD+IhMtpfv7KRCwMVjJDiJwhd8ghvsNhBh8DjgqfF7l64fAbUJcj//YaN+NlmgisnRO5jNwhh+bwMSbnRb5xTuTCRZHnOM9LGxFAzpA75DBljf8PNhWQD8NxltgAAAAASUVORK5CYII="/>
  </pattern>
  <path d="m0 0h160v160h-160z" fill="url(#a)"/>
</svg>`;
  const DOWNLOAD_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    DOWNLOAD_ICON_SVG_RAW
  )}`;
  const SUCCESS_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    SUCCESS_ICON_SVG_RAW
  )}`;
  const ERROR_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    ERROR_ICON_SVG_RAW
  )}`;
  const STYLE_ID = "cqd-style";
  const SPINNER_SIZE_PX = 16;
  const TRANSITION_MS = 150;
  const TRANSITION_STR = `${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1)`;
  function injectStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    :root {
      --cqd-transition: ${TRANSITION_STR};
      --cqd-color-primary: #1a73e8;
      --cqd-color-success: #34a853;
      --cqd-color-error: #e05952;
      --cqd-shadow-base: 0 0px 10px rgba(15, 23, 42, 0.22);
      --cqd-shadow-hover: 0 10px 24px rgba(15, 23, 42, 0.30);
      --cqd-shadow-pill: 0 8px 22px rgba(15, 23, 42, 0.30);
      --cqd-shadow-success: 0 12px 28px rgba(24, 128, 56, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(24, 128, 56, 0.70);
      --cqd-shadow-error: 0 12px 28px rgba(224, 89, 82, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(224, 89, 82, 0.70);
    }

    /* ===============================
     * Base button: circle → pill
     * =============================== */
    .cqd-download-btn {
      position: absolute;
      top: 50%;
      right: 8px;
      z-index: 5;

      display: inline-flex;
      align-items: center;
      justify-content: center;

      height: 40px;
      width: 40px;
      max-width: calc(100% - 16px);

      padding: 0;
      border: none;
      border-radius: 9999px;

      background-color: var(--cqd-color-primary);
      color: #ffffff;
      box-shadow: var(--cqd-shadow-base);

      cursor: pointer;
      transform: translateY(-50%) scale(1);

      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;

      will-change: transform, box-shadow, width, border-radius, padding-inline;
      transition:
        width var(--cqd-transition),
        padding-inline var(--cqd-transition),
        border-radius var(--cqd-transition),
        box-shadow var(--cqd-transition),
        transform var(--cqd-transition),
        background-color var(--cqd-transition);
    }

    /* Hover (IDLE only: do NOT touch error / loading / success) */
    .cqd-download-btn:not(.cqd-loading):not(.cqd-success):not(.cqd-error):hover {
      width: 120px;
      padding-inline: 12px;
      box-shadow: var(--cqd-shadow-hover);
      justify-content: flex-start;
      transform: translateY(-50%) scale(1);
      border-radius: 20px;
    }

    .cqd-download-btn:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
    }

    .cqd-download-btn:active {
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.3);
      transform: translateY(-50%) scale(0.97);
    }

    /* ===============================
     * Icon & label
     * =============================== */
    .cqd-download-btn .cqd-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cqd-download-icon {
      display: block;
      width: 24px;
      height: 24px;
      background-image: url("${DOWNLOAD_ICON_SVG_URL}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 24px 24px;
      flex-shrink: 0;
      transform-origin: center;
      transition:
        width var(--cqd-transition),
        height var(--cqd-transition),
        border-width var(--cqd-transition);
    }

    .cqd-icon-small {
      width: 16px;
      height: 16px;
      background-size: 16px 16px;
    }

    .cqd-icon-medium {
      width: 24px;
      height: 24px;
      background-size: 24px 24px;
    }

    .cqd-icon-large {
      width: 32px;
      height: 32px;
      background-size: 32px 32px;
    }

    /* Label: hidden by default (circle) */
    .cqd-download-btn .cqd-label {
      opacity: 0;
      margin-left: 0;
      max-width: 0;
      overflow: hidden;
      transition:
        opacity var(--cqd-transition),
        max-width var(--cqd-transition),
        margin-left var(--cqd-transition);
    }

    /* Show label on (except error state, which has its own logic) */
    .cqd-download-btn:not(.cqd-loading):not(.cqd-error):not(.cqd-success):hover .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 4px;
    }

    /* ===============================
     * Shared pill state (loading / success / error)
     * =============================== */
    .cqd-download-btn.cqd-loading,
    .cqd-download-btn.cqd-success,
    .cqd-download-btn.cqd-error {
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      box-shadow: var(--cqd-shadow-pill);
      cursor: default;
      width: 150px;
      transform: translateY(-50%) scale(1);
    }

    .cqd-download-btn.cqd-loading:active,
    .cqd-download-btn.cqd-success:active,
    .cqd-download-btn.cqd-error:active {
      transform: translateY(-50%) scale(1);
      box-shadow: var(--cqd-shadow-pill);
    }

    /* ===============================
     * Loading state
     * =============================== */
    .cqd-download-btn.cqd-loading .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 12px;
    }

    .cqd-download-btn.cqd-loading:hover {
      padding-inline: 12px;
      border-radius: 20px;
      transform: translateY(-50%) scale(1);
      box-shadow: var(--cqd-shadow-pill);
    }

    /* ===============================
     * Success (green pill)
     * =============================== */
    .cqd-download-btn.cqd-success {
      width: 140px;
      background-color: var(--cqd-color-success);
      box-shadow: var(--cqd-shadow-success);
    }

    .cqd-download-btn.cqd-success .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 8px;
    }

    .cqd-download-btn.cqd-success:hover {
      width: 140px;
      transform: translateY(-50%) scale(1);
      box-shadow: var(--cqd-shadow-success-strong);
    }

    /* ===============================
     * Error (red pill → squircle)
     * =============================== */

    /* Base error pill (no hover): show "Error" text clearly */
    .cqd-download-btn.cqd-error {
      width: 90px;
      background-color: var(--cqd-color-error);
      box-shadow: var(--cqd-shadow-error);

      /* give the button concrete “from” values so they can animate */
      height: 40px; 
      max-width: 150px;
      max-height: 40px;
      padding-top: 0;
      padding-bottom: 0;
      align-items: center;

      transition:
        width var(--cqd-transition),
        height var(--cqd-transition),
        padding-inline var(--cqd-transition),
        padding-top var(--cqd-transition),
        padding-bottom var(--cqd-transition),
        border-radius var(--cqd-transition),
        box-shadow var(--cqd-transition),
        background-color var(--cqd-transition),
        transform var(--cqd-transition),
        max-width var(--cqd-transition),
        max-height var(--cqd-transition);
    }

    .cqd-download-btn.cqd-error .cqd-label {
      opacity: 1;
      margin-left: 8px;
      max-width: 110px;
      overflow: hidden;
      flex: 0 0 auto;
    }

    /* Error detail text (hidden until hover, but pre-laid-out) */
    .cqd-error-detail {
      display: block;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.3;

      margin-left: 0;
      margin-top: 0;

      opacity: 0;
      max-height: 0;
      overflow: hidden;
      white-space: normal;
      transform: translateY(4px);

      transition:
        opacity var(--cqd-transition),
        transform var(--cqd-transition),
        margin-top var(--cqd-transition),
        max-height var(--cqd-transition);
    }

    /* On error hover: pill -> taller rounded square with full message */
    .cqd-download-btn.cqd-error:hover {
      width: 350px;
      max-width: 360px;
      height: 60px;
      max-height: 61px;
      padding-top: 8px;
      padding-bottom: 8px;
      border-radius: 18px;
      align-items: center;
      white-space: normal;
      gap: 7px;
      box-shadow: var(--cqd-shadow-error-strong);
    }

    /* Cross-fade label → detail */
    .cqd-download-btn.cqd-error:hover .cqd-label {
      opacity: 0;
      max-width: 0;
      margin-left: 0;
    }

    .cqd-download-btn.cqd-error:hover .cqd-error-detail {
      opacity: 1;
      max-height: 60px;
      margin-top: 4px;
      transform: translateY(0);
    }

    /* ===============================
     * Spinner state (loading)
     * =============================== */
    .cqd-spinner {
      background-image: none;
      border-radius: 9999px;
      width: ${SPINNER_SIZE_PX}px;
      height: ${SPINNER_SIZE_PX}px;
      border-style: solid;
      border-width: 3px;
      border-color: rgba(255, 255, 255, 0.22);
      border-top-color: #ffffff;
      border-right-color: #ffffff;
      box-shadow: none;
      animation: cqd-spin 0.65s linear infinite;
    }

    @keyframes cqd-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `.trim();
    (document.head || document.documentElement).appendChild(style);
  }
  const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;
  const INJECTED_ATTR = "data-cqd-injected";
  const RESCAN_INTERVAL_MS = 2e3;
  const RESCAN_DEBOUNCE_MS = 250;
  const LOADING_MIN_MS = 600;
  const FEEDBACK_SUCCESS_MS = 2e3;
  const FEEDBACK_ERROR_MS = 4e3;
  const DRIVE_ANCHOR_SELECTOR = 'a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]';
  const ATTACHMENT_CONTAINER_SELECTOR = [
    ".KlRXdf",
    // common attachment card
    ".z3vRcc",
    // chip-like attachment
    ".VfPpkd-aPP78e",
    // Material card wrapper
    "[data-drive-id]",
    // Drive attachment
    "[data-id][data-item-id]"
    // metadata blocks
  ].join(", ");
  const DRIVE_URL_PATTERNS = [
    /https:\/\/drive\.google\.com\/file\/d\//,
    /https:\/\/drive\.google\.com\/open\?/,
    /https:\/\/drive\.google\.com\/uc\?/,
    /https:\/\/classroom\.google\.com\/drive\//
  ];
  let scanTimeoutId = null;
  let observer = null;
  const pendingButtons = /* @__PURE__ */ new Map();
  let nextRequestSeq = 1;
  function isGoogleClassroom() {
    if (typeof location === "undefined") return false;
    if (location.hostname !== "classroom.google.com") return false;
    return CLASSROOM_URL_PATTERN.test(location.href);
  }
  function scheduleScan() {
    if (scanTimeoutId !== null) {
      window.clearTimeout(scanTimeoutId);
    }
    scanTimeoutId = window.setTimeout(() => {
      scanTimeoutId = null;
      scanForAttachments();
    }, RESCAN_DEBOUNCE_MS);
  }
  function setupObservers() {
    if (typeof document === "undefined") return;
    if (!document.body) {
      window.addEventListener(
        "DOMContentLoaded",
        () => {
          setupObservers();
        },
        { once: true }
      );
      return;
    }
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      const hasChildListChange = mutations.some(
        (m) => m.type === "childList" && (m.addedNodes.length > 0 || m.removedNodes.length > 0)
      );
      if (hasChildListChange) {
        scheduleScan();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setInterval(() => {
      scheduleScan();
    }, RESCAN_INTERVAL_MS);
    scheduleScan();
  }
  function scanForAttachments() {
    if (!isGoogleClassroom()) return;
    if (typeof document === "undefined") return;
    injectSingleFileButtons();
  }
  function injectSingleFileButtons() {
    const anchors = Array.from(
      document.querySelectorAll(DRIVE_ANCHOR_SELECTOR)
    );
    for (const anchor of anchors) {
      const url = extractDriveUrlFromAnchor(anchor);
      if (!url) continue;
      const container = anchor.closest(ATTACHMENT_CONTAINER_SELECTOR) || anchor.parentElement || anchor;
      if (!container) continue;
      if (hasInjectedButton(container)) continue;
      injectButtonIntoAttachment(container, url);
    }
    const metaElements = Array.from(
      document.querySelectorAll(
        "[data-drive-id], [data-id][data-item-id], [data-id][data-tooltip]"
      )
    );
    for (const el of metaElements) {
      if (hasInjectedButton(el)) continue;
      const url = findDriveUrl(el);
      if (!url) continue;
      injectButtonIntoAttachment(el, url);
    }
  }
  function hasInjectedButton(container) {
    return !!container.querySelector(`[${INJECTED_ATTR}="true"]`);
  }
  function extractDriveUrlFromAnchor(anchor) {
    const href = anchor.href;
    if (!href) return null;
    const isDriveUrl = DRIVE_URL_PATTERNS.some((re) => re.test(href));
    return isDriveUrl ? href : null;
  }
  function findDriveUrl(element) {
    const nearAnchor = element.querySelector(DRIVE_ANCHOR_SELECTOR) || element.closest(DRIVE_ANCHOR_SELECTOR);
    if (nearAnchor) {
      const href = extractDriveUrlFromAnchor(nearAnchor);
      if (href) return href;
    }
    const driveId = element.getAttribute("data-drive-id") || element.getAttribute("data-id");
    if (driveId) {
      const anchorWithId = document.querySelector(
        `a[data-drive-id="${driveId}"]`
      ) || document.querySelector(`a[data-id="${driveId}"]`) || document.querySelector(`a[href*="${driveId}"]`);
      if (anchorWithId) {
        const href = extractDriveUrlFromAnchor(anchorWithId);
        if (href) return href;
      }
      return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
        driveId
      )}`;
    }
    return null;
  }
  function toDownloadUrl(originalUrl, depth = 0) {
    if (depth > 3) return originalUrl;
    try {
      const parsed = new URL(originalUrl, location.href);
      const hostname = parsed.hostname;
      const pathname = parsed.pathname;
      if (hostname === "drive.google.com") {
        if (pathname.startsWith("/auth_warmup")) {
          const cont = parsed.searchParams.get("continue");
          if (cont) return toDownloadUrl(cont, depth + 1);
          const id = parsed.searchParams.get("id");
          if (id) {
            return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
              id
            )}`;
          }
          return originalUrl;
        }
        const fileMatch = pathname.match(/^\/file\/d\/([^/]+)/);
        if (fileMatch) {
          const id = fileMatch[1];
          return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
            id
          )}`;
        }
        if (pathname === "/open") {
          const id = parsed.searchParams.get("id");
          if (id) {
            return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
              id
            )}`;
          }
        }
        if (pathname === "/uc") {
          parsed.searchParams.set("export", "download");
          return parsed.toString();
        }
      }
      if (hostname === "classroom.google.com" && pathname.startsWith("/drive")) {
        const id = parsed.searchParams.get("id") || parsed.searchParams.get("resourceId") || parsed.searchParams.get("fileId");
        if (id) {
          return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
            id
          )}`;
        }
      }
      return originalUrl;
    } catch {
      return originalUrl;
    }
  }
  function cleanAttachmentName(rawName) {
    if (!rawName) return "";
    let name = rawName.trim();
    const extensions = [
      "pdf",
      "mp4",
      "mov",
      "avi",
      "mkv",
      "jpg",
      "jpeg",
      "png",
      "docx",
      "doc",
      "xlsx",
      "xls",
      "pptx",
      "ppt",
      "zip",
      "rar",
      "txt",
      "csv",
      "html"
    ];
    const lower = name.toLowerCase();
    for (const ext of extensions) {
      const pattern = `.${ext}${ext}`;
      if (lower.endsWith(pattern)) {
        return name.slice(0, -ext.length).trim();
      }
      if (lower.endsWith(`.${ext}`)) {
        return name;
      }
      if (lower.endsWith(`.${ext}${ext}`)) {
        return name.slice(0, -ext.length);
      }
    }
    const commonLabels = [
      "PDF",
      "Video",
      "Image",
      "Audio",
      "Text",
      "Word",
      "Excel",
      "PowerPoint",
      "Archive"
    ];
    for (const label of commonLabels) {
      if (name.endsWith(label)) {
        const withoutLabel = name.slice(0, -label.length).trim();
        if (/\.[a-z0-9]{2,5}$/i.test(withoutLabel)) {
          return withoutLabel;
        }
      }
    }
    return name;
  }
  function extractFileMeta(container, url) {
    let name;
    const tooltip = container.getAttribute("data-tooltip") || container.getAttribute("aria-label") || container.getAttribute("title");
    if (tooltip && tooltip.trim()) {
      name = tooltip.trim();
    } else {
      const text = (container.textContent || "").trim();
      if (text) {
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          name = lines[0];
        }
      }
    }
    if (!name) {
      try {
        const u = new URL(url);
        const pathName = decodeURIComponent(u.pathname.split("/").pop() || "");
        if (pathName && pathName.includes(".")) {
          name = pathName;
        }
      } catch {
      }
    }
    if (name) {
      name = cleanAttachmentName(name);
    }
    let ext;
    if (name) {
      const m = name.match(/\.([a-zA-Z0-9]{1,6})$/);
      if (m) ext = m[1].toLowerCase();
    }
    if (!ext) {
      try {
        const u = new URL(url);
        const path = u.pathname;
        const m2 = path.match(/\.([a-zA-Z0-9]{1,6})$/);
        if (m2) ext = m2[1].toLowerCase();
      } catch {
      }
    }
    let kind;
    if (ext) {
      if (["pdf"].includes(ext)) kind = "pdf";
      else if (["doc", "docx"].includes(ext)) kind = "doc";
      else if (["xls", "xlsx", "csv"].includes(ext)) kind = "sheet";
      else if (["ppt", "pptx"].includes(ext)) kind = "slide";
      else if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext))
        kind = "image";
      else if (["zip", "rar", "7z"].includes(ext)) kind = "archive";
      else if (["mp4", "mov", "mkv", "avi"].includes(ext)) kind = "video";
      else if (["html", "htm"].includes(ext)) kind = "html";
      else kind = "other";
    }
    return { name, ext, kind };
  }
  function injectButtonIntoAttachment(container, url) {
    if (!url) return;
    const computed = window.getComputedStyle(container);
    if (computed.position === "static") {
      container.style.position = "relative";
    }
    const directUrl = toDownloadUrl(url);
    const fileMeta = extractFileMeta(container, directUrl);
    const button = createDownloadButton(container, directUrl, fileMeta);
    const iconEl = button.querySelector(".cqd-download-icon");
    if (iconEl) {
      iconEl.classList.add("cqd-icon-medium");
    }
    container.appendChild(button);
  }
  function getButtonState(button) {
    if (button.classList.contains("cqd-loading")) return "loading";
    if (button.classList.contains("cqd-success")) return "success";
    if (button.classList.contains("cqd-error")) return "error";
    return "idle";
  }
  function setButtonState(button, state, options) {
    const icon = button.querySelector(".cqd-download-icon");
    const label = button.querySelector(".cqd-label");
    const errorDetail = button.querySelector(
      ".cqd-error-detail"
    );
    if (!icon || !label || !errorDetail) return;
    button.classList.remove("cqd-loading", "cqd-success", "cqd-error");
    icon.classList.remove("cqd-spinner");
    icon.textContent = "";
    button.disabled = false;
    button.style.backgroundColor = "#1a73e8";
    label.textContent = "Download";
    errorDetail.textContent = "";
    icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
    icon.style.backgroundSize = "";
    switch (state) {
      case "idle":
        break;
      case "loading":
        button.classList.add("cqd-loading");
        button.disabled = true;
        label.textContent = "Downloading…";
        icon.classList.add("cqd-spinner");
        icon.style.backgroundImage = "none";
        break;
      case "success":
        button.classList.add("cqd-success");
        button.style.backgroundColor = "#188038";
        label.textContent = "Downloaded";
        icon.style.backgroundImage = `url("${SUCCESS_ICON_SVG_URL}")`;
        icon.style.backgroundSize = "20px 20px";
        break;
      case "error":
        button.classList.add("cqd-error");
        button.style.backgroundColor = "#e05952";
        label.textContent = "Error";
        icon.style.backgroundImage = `url("${ERROR_ICON_SVG_URL}")`;
        icon.style.backgroundSize = "20px 20px";
        errorDetail.textContent = options?.userMessage || "Something went wrong while downloading this file.";
        break;
    }
  }
  function createDownloadButton(_container, url, fileMeta) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cqd-download-btn";
    button.setAttribute(INJECTED_ATTR, "true");
    button.setAttribute("aria-label", "Quick download attachment");
    button.setAttribute("title", "Quick download");
    const iconWrapper = document.createElement("span");
    iconWrapper.className = "cqd-icon-wrapper";
    const iconSpan = document.createElement("span");
    iconSpan.className = "cqd-download-icon";
    iconWrapper.appendChild(iconSpan);
    const label = document.createElement("span");
    label.className = "cqd-label";
    label.textContent = "Download";
    const errorDetail = document.createElement("span");
    errorDetail.className = "cqd-error-detail";
    errorDetail.textContent = "";
    button.appendChild(iconWrapper);
    button.appendChild(label);
    button.appendChild(errorDetail);
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await handleSingleDownloadClick(button, url, fileMeta);
    });
    button.addEventListener("auxclick", async (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      await handleSingleDownloadClick(button, url, fileMeta);
    });
    return button;
  }
  async function handleSingleDownloadClick(button, url, fileMeta) {
    if (!url) return;
    const currentState = getButtonState(button);
    if (currentState !== "idle") return;
    const requestId = `cqd-${Date.now()}-${nextRequestSeq++}`;
    const startedAt = Date.now();
    setButtonState(button, "loading");
    const startResult = await startBackgroundDownload(requestId, url, fileMeta);
    await ensureMinLoading(startedAt);
    if (!startResult.ok) {
      await showErrorState(button, startResult.userMessage);
      return;
    }
    setButtonState(button, "success");
    await delay(FEEDBACK_SUCCESS_MS);
    if (getButtonState(button) === "success") {
      setButtonState(button, "idle");
    }
  }
  function startBackgroundDownload(requestId, url, fileMeta) {
    const finalUrl = toDownloadUrl(url);
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        resolve({
          ok: false,
          userMessage: "The extension runtime is not available. Reload page."
        });
        return;
      }
      try {
        chrome.runtime.sendMessage(
          {
            type: "CQD_DOWNLOAD",
            url: finalUrl,
            requestId,
            fileMeta
          },
          (response) => {
            const err = chrome.runtime.lastError;
            if (err) {
              console.warn("[CQD] sendMessage error:", err.message);
              resolve({
                ok: false,
                userMessage: "Connection to extension failed."
              });
              return;
            }
            if (!response || response.started === false) {
              resolve({
                ok: false,
                userMessage: response?.userMessage || "Could not start the download."
              });
              return;
            }
            resolve({ ok: true });
          }
        );
      } catch (e) {
        console.warn("[CQD] sendMessage threw:", e);
        resolve({
          ok: false,
          userMessage: "Extension communication error."
        });
      }
    });
  }
  function setupDownloadStatusListener() {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return;
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      if (!message || message.type !== "CQD_DOWNLOAD_STATUS") return;
      const {
        requestId,
        status,
        userMessage
      } = message;
      const pending = pendingButtons.get(requestId);
      if (!pending) return;
      void handleDownloadStatusForButton(pending, status, userMessage);
    });
  }
  async function handleDownloadStatusForButton(pending, status, userMessage) {
    const { button, startedAt, requestId } = pending;
    await ensureMinLoading(startedAt);
    if (status === "complete") {
      setButtonState(button, "success");
      await delay(FEEDBACK_SUCCESS_MS);
      setButtonState(button, "idle");
    } else {
      await showErrorState(button, userMessage);
    }
    pendingButtons.delete(requestId);
  }
  async function showErrorState(button, userMessage) {
    setButtonState(button, "error", { userMessage });
    const earliestReset = Date.now() + FEEDBACK_ERROR_MS;
    while (true) {
      await delay(200);
      if (getButtonState(button) !== "error") {
        return;
      }
      const now = Date.now();
      if (now < earliestReset) {
        continue;
      }
      const hovered = button.matches(":hover");
      if (!hovered) {
        setButtonState(button, "idle");
        return;
      }
    }
  }
  async function ensureMinLoading(startedAt) {
    const elapsed = Date.now() - startedAt;
    if (elapsed < LOADING_MIN_MS) {
      await delay(LOADING_MIN_MS - elapsed);
    }
  }
  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
  function initContentScript() {
    if (!isGoogleClassroom()) return;
    injectStyles();
    setupDownloadStatusListener();
    setupObservers();
  }
  const definition = defineContentScript({
    matches: ["https://classroom.google.com/*"],
    runAt: "document_idle",
    main() {
      initContentScript();
    }
  });
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  function print$1(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger$1 = {
    debug: (...args) => print$1(console.debug, ...args),
    log: (...args) => print$1(console.log, ...args),
    warn: (...args) => print$1(console.warn, ...args),
    error: (...args) => print$1(console.error, ...args)
  };
  class WxtLocationChangeEvent extends Event {
    constructor(newUrl, oldUrl) {
      super(WxtLocationChangeEvent.EVENT_NAME, {});
      this.newUrl = newUrl;
      this.oldUrl = oldUrl;
    }
    static EVENT_NAME = getUniqueEventName("wxt:locationchange");
  }
  function getUniqueEventName(eventName) {
    return `${browser?.runtime?.id}:${"content"}:${eventName}`;
  }
  function createLocationWatcher(ctx) {
    let interval;
    let oldUrl;
    return {
      /**
       * Ensure the location watcher is actively looking for URL changes. If it's already watching,
       * this is a noop.
       */
      run() {
        if (interval != null) return;
        oldUrl = new URL(location.href);
        interval = ctx.setInterval(() => {
          let newUrl = new URL(location.href);
          if (newUrl.href !== oldUrl.href) {
            window.dispatchEvent(new WxtLocationChangeEvent(newUrl, oldUrl));
            oldUrl = newUrl;
          }
        }, 1e3);
      }
    };
  }
  class ContentScriptContext {
    constructor(contentScriptName, options) {
      this.contentScriptName = contentScriptName;
      this.options = options;
      this.abortController = new AbortController();
      if (this.isTopFrame) {
        this.listenForNewerScripts({ ignoreFirstEvent: true });
        this.stopOldScripts();
      } else {
        this.listenForNewerScripts();
      }
    }
    static SCRIPT_STARTED_MESSAGE_TYPE = getUniqueEventName(
      "wxt:content-script-started"
    );
    isTopFrame = window.self === window.top;
    abortController;
    locationWatcher = createLocationWatcher(this);
    receivedMessageIds = /* @__PURE__ */ new Set();
    get signal() {
      return this.abortController.signal;
    }
    abort(reason) {
      return this.abortController.abort(reason);
    }
    get isInvalid() {
      if (browser.runtime.id == null) {
        this.notifyInvalidated();
      }
      return this.signal.aborted;
    }
    get isValid() {
      return !this.isInvalid;
    }
    /**
     * Add a listener that is called when the content script's context is invalidated.
     *
     * @returns A function to remove the listener.
     *
     * @example
     * browser.runtime.onMessage.addListener(cb);
     * const removeInvalidatedListener = ctx.onInvalidated(() => {
     *   browser.runtime.onMessage.removeListener(cb);
     * })
     * // ...
     * removeInvalidatedListener();
     */
    onInvalidated(cb) {
      this.signal.addEventListener("abort", cb);
      return () => this.signal.removeEventListener("abort", cb);
    }
    /**
     * Return a promise that never resolves. Useful if you have an async function that shouldn't run
     * after the context is expired.
     *
     * @example
     * const getValueFromStorage = async () => {
     *   if (ctx.isInvalid) return ctx.block();
     *
     *   // ...
     * }
     */
    block() {
      return new Promise(() => {
      });
    }
    /**
     * Wrapper around `window.setInterval` that automatically clears the interval when invalidated.
     *
     * Intervals can be cleared by calling the normal `clearInterval` function.
     */
    setInterval(handler, timeout) {
      const id = setInterval(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearInterval(id));
      return id;
    }
    /**
     * Wrapper around `window.setTimeout` that automatically clears the interval when invalidated.
     *
     * Timeouts can be cleared by calling the normal `setTimeout` function.
     */
    setTimeout(handler, timeout) {
      const id = setTimeout(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearTimeout(id));
      return id;
    }
    /**
     * Wrapper around `window.requestAnimationFrame` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelAnimationFrame` function.
     */
    requestAnimationFrame(callback) {
      const id = requestAnimationFrame((...args) => {
        if (this.isValid) callback(...args);
      });
      this.onInvalidated(() => cancelAnimationFrame(id));
      return id;
    }
    /**
     * Wrapper around `window.requestIdleCallback` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelIdleCallback` function.
     */
    requestIdleCallback(callback, options) {
      const id = requestIdleCallback((...args) => {
        if (!this.signal.aborted) callback(...args);
      }, options);
      this.onInvalidated(() => cancelIdleCallback(id));
      return id;
    }
    addEventListener(target, type, handler, options) {
      if (type === "wxt:locationchange") {
        if (this.isValid) this.locationWatcher.run();
      }
      target.addEventListener?.(
        type.startsWith("wxt:") ? getUniqueEventName(type) : type,
        handler,
        {
          ...options,
          signal: this.signal
        }
      );
    }
    /**
     * @internal
     * Abort the abort controller and execute all `onInvalidated` listeners.
     */
    notifyInvalidated() {
      this.abort("Content script context invalidated");
      logger$1.debug(
        `Content script "${this.contentScriptName}" context invalidated`
      );
    }
    stopOldScripts() {
      window.postMessage(
        {
          type: ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE,
          contentScriptName: this.contentScriptName,
          messageId: Math.random().toString(36).slice(2)
        },
        "*"
      );
    }
    verifyScriptStartedEvent(event) {
      const isScriptStartedEvent = event.data?.type === ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE;
      const isSameContentScript = event.data?.contentScriptName === this.contentScriptName;
      const isNotDuplicate = !this.receivedMessageIds.has(event.data?.messageId);
      return isScriptStartedEvent && isSameContentScript && isNotDuplicate;
    }
    listenForNewerScripts(options) {
      let isFirst = true;
      const cb = (event) => {
        if (this.verifyScriptStartedEvent(event)) {
          this.receivedMessageIds.add(event.data.messageId);
          const wasFirst = isFirst;
          isFirst = false;
          if (wasFirst && options?.ignoreFirstEvent) return;
          this.notifyInvalidated();
        }
      };
      addEventListener("message", cb);
      this.onInvalidated(() => removeEventListener("message", cb));
    }
  }
  function initPlugins() {
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  const result = (async () => {
    try {
      initPlugins();
      const { main, ...options } = definition;
      const ctx = new ContentScriptContext("content", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"content"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2luZGV4LnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3eHQtZGV2K2Jyb3dzZXJAMC4xLjQvbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCIvLyBlbnRyeXBvaW50cy9pY29ucy50c1xuXG4vLyBSYXcgU1ZHc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIj5cbiAgPGcgc3Ryb2tlPVwiI0ZGRkZGRlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj5cbiAgICA8cGF0aCBkPVwiTTYgMjFIMThcIiAvPlxuICAgIDxwYXRoIGQ9XCJNMTIgM1YxN1wiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0wxNyAxMlwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0w3IDEyXCIgLz5cbiAgPC9nPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfUkFXID0gYDxzdmcgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbjxyZWN0IHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgZmlsbD1cInVybCgjcGF0dGVybjBfMV8yNDg0KVwiLz5cbjxkZWZzPlxuPHBhdHRlcm4gaWQ9XCJwYXR0ZXJuMF8xXzI0ODRcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIiBoZWlnaHQ9XCIxXCI+XG48dXNlIHhsaW5rOmhyZWY9XCIjaW1hZ2UwXzFfMjQ4NFwiIHRyYW5zZm9ybT1cInNjYWxlKDAuMDA2MjUpXCIvPlxuPC9wYXR0ZXJuPlxuPGltYWdlIGlkPVwiaW1hZ2UwXzFfMjQ4NFwiIHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBZ0FFbEVRVlI0QWUyZENYaFY1YlgzMTBuSVNNaDRoaVNvVjJ0cmhjb0RhdWwzYXd2NlZhdlgxdFQyRnJWZSsvVzI5N2IzWHUwVmVqKzEwZXNVNWxFSVF4Sm1FSWhsa0Rsa25nZENFaVNNQWlLelJmQlc4R3VyRld2OWY4Ly8zZnROTmpGSWhuMU9Uc0xlejdOeWpKeWN2ZC8xLysyMTNyWDJ1L2NSQ2NTV0llSHlndThHeWZEZEl5OTVuZ3pKY0dlN010eWJYQm0rU2xlR2Q0Y3J3N3ZUTmRiWDVNcG9ZL3gvam5YZkIrMzVsVDVYdnFjRzdrM1VSRjcwakphWHZOODF0Skx3UUtEaHYzMDhHNWNnTDNudkMzblpNOTcxc3FmQWxlRTk2UnJyL1l0cm5BK3U4YVpOOE1JMXdRZlh4TXZZSkI5Y2puWGZCNWZ6TDMxUERiUWUxR2FzOTJPbDFjdWVBbXBIRFlWYTlwcnR4YVRoUXVneVBFMnVzZDZMcnZHRXpBdlhSQzljazcxd1RmSEJOZFcwYVQ2NHRFMzN3YVZ0aGcrdXRxYi96WGx0OWRNWCthS3QvL2k3OWYzYTczelZlbEFiYWtTdEZKaGVBbm1SV2xKVG9iWkJ1NzNrdTFzeXZLdGtyUGQ5R2UrRlRQUkNKbnNoVTd5UWFUN0lkQjlraGcveWlnOHkwd2VabFF6SlRJYk05a0ZtODlXME9ja1F4L3puQSsxbjllb3pOS0FXMUlUYVVDTnFSYzJvSFRXa2x0U1UybEpqYWgwMDI0dWVXeVhEczF6R2VqK1VDVHhnSHJnNWdCa2NtQVl0R1RJM0dUSXZCWktWQXNsT2dlU2tRT2Ezc1FVcGtMYTJNQlhpV09kOTBOYVAvTDJ0djZrRGpacFFHMnBFT0JrY3FCMDFWREQ2REcycE1iV201dFMreDdZTVQ0eTg3SGxXeG5yZU1jQmpwUE1hWnhEUEpnNkNrU3dydVJXMGhTbVFSU21RSlNtUXBiUlV5TEpVeUhLckRZUzg2cGhmZkxCODRLVytwdStwQWJXZ0p0U0dHaEZTQmdkcVJ3MnBKVFZsZEtUR2pJb0tSTTg3aW9IZnVnY0Vsa09TUDlaVEtPTTl4c0VvOEx5UVdUN0lISjhKWGJJUnlSYWJzQzFMZ2J5YUNsbVJDbG1aQWxucGc2ejBRRlltUVZZbVFGYkdHN1lxQWVLWS8zeWcvRXgvMCtoN2FrQXRVZ3h0cUJHMUlwVFVqbEV6eHd3azFKWWF6ekNERFVFa0EyUWhZTkV3dy8wVEdlYzVydVlGVXhueE5IakprR3dUT2hYbHpLaEc0SElIUW5LVElibHVTRzRDNUhkdTlGdDNEZUkyM1l4cjhtN0hWd3UvalNIRi94dkRTcjdqV0FCOE1LVDRMbnkxNEZ2Szk5U0FXbEFUcFkzU2lGb05OSUJrZGxxU2FrUkh3a2lOR1JVMWlHU0FjMFF5UVRiOHVvMzFQaVBqUFIrcUVNeW94N0NzMHl3UGptY013enFoV3pVUThqdWFGL0s3Uk1nNkh6eGJiOEh3OHZ2eFVPTy80Ny8ydll4eGh6SXg4KzJGbUhkOE9lYWZXSVdGSjNNZEM0QVA2R3Y2bkw2bkJ0VGk0Y2IvVU5wUUkycWxORlBhRFRTMHBLYlVWa2RGblo3SmdFN0xaSU9NK0dYTGNJK1ZDUjZqTW1MVXkvUkM1dm1NOE15SXg1RE44TDBxMVFCdmpRK3lKZ0dSbTY3SGJlWGZ4YjgwLzE5TU9qSVhDMCt1d3ZKMzFpcGJlbm8xRnAxK0RRdFByY0lDeHdMcWc0V25WeW5mVXdPbHgrbTFTaHRxUksyb0diV2poa0l0R1V5b0xUV20xdFNjcVprTWtBVXl3YXFaakpBVlc3ZTI4TEYxa3VXRExFZzJKcSt2cGxqQVMxRUhIYkhwT3R4Ui9RQ2VQakFXMlNkZnhkSjNWb09EempxNURITlBMc0VjMnFrbG1IdHFxV005NkFOcVFDMm9DYldoUnRTS21sRTdha2d0RFJCVExDQ2FoUXNaSUF0a3dpOFFqbk0vTFJNOUVPYjZWN3lRMlY1akhzQnFpWk5WVGw1ZlM0V3NIUWhaNjRXczkyQlEyUWlNM3YraUdzVEMweXZWQUdlZFhJaFdXNFJaSnhkaDFpbkhnc0lIMUVKWnEwYUVrdG9SUkdwSlRhbXQwcGhhVTNOcVR3YklBdWVHWklPTXFIa2hpeFAzVTkwTGhCbWVVVExSL1pGTTlSZ2ZQTWNMeWZGQkZpVkRsalBxcFVCV3AwTFdwVUplVDBUL3JkZmp3Y1oveG94ak9jZzU5U3BtbmxpQTZTZHlNUDFrRG1iUVRsM0dUdWRnaG1PQjk4SGw5RGhwYUVidHFDRzFwS2JVbGhwVGE2VTV0U2NEWklGTWtBMHlvaUQwUUxFejF2TlExeUFjNXgwcUU5eW5XdUNiYThLM09CbnlLcXNrcGxxQ2x3SlpuNGlVb2lGNGZGKzZDdVV6VCtSZ3l2RzVtSEppTHFhY3ROaXB1WmhpdGROek1hWEY1bUhLYWNjQzV3T0w3NjJhOEwrdG1sSEQ0M05CVFptbXFURzFsdlVKaHZaa2dDeVFDYkpCQ01sS0s0U25oU3gxYW1PVGVZS25XS2E2SVRPOUJ0WHpmY1lPdUtQWFVpQnJVeUViVWlBYkUzRmorZi9DYncrTng2eVRDekRwZUNZbUhKK0ZDU2N5TWVHa3hVNWxZa0piTzUySkNWWnIrKy9PNzUvM21SMCtzZnFjLzkzZVoxcTFvNWJIWnlsdHFmRnZENDNEbDhxL29iUlhESkFGTXFFaEpDdU1oR1NIREpFbE10WGhiWHhTdWt4eFg1cDJXeUlmNTNzbWZKc1M4WldLdjhlemh5ZGcyb2w1eURnMkhSbkhweVBqaEdrblp5QkQyNmtaeUhDczkvaEE2OFpYclNlMVBUWmRhVTNOcWIxc1NqUUNFWm5JWlpWc2lZUTZIWk9sQ1VuUGRveS9jYjRoTXNsOVRtWjR6SUtqVGVUamZHOWpLbVJURXE0cnZ4MVBIYzdBeE9PejhQelJ5WGpoMkdTOGNId3lYamd4cGRWT1RzRUxWanZWNW5mOWIvei9qZ1hPQjlydjF0ZjJ0TEZxU1cyUFRWWmFVM05xVHdiSWdtS0NiRmdqWVRhclk3Wm9QRkJNa2EwdjNESWtSTVo3WHBWcEhxTzN3L0phRlJ6bW5JK1VieHdJMmV4R1l2RWcvUHVCWjlRWmtmNzJlS1FmSFkvMFk2WWRuNEIwYlNjbUlGM2J5UWxJcCtuZm5kZmc4a1Y3K21nZCthcjFwZFp2ajFmYWt3R3lRQ1lVR3lvU3NqQkpOdGdoUSt3VGtpbXlSY1l1dTAzd2pKUXA3bzlrcGdjeXp3dFo0SU1zODBGV0pVUFdwRUEycEVJMmV4RmVjQTErM1B5dmVQSHR5WGpxeUV0NDZ1Mlg4TlRSbC9EVXNaY05PLzRTbm5LczcvbEE2MHV0cWZtUmx4UURaSUZNa0EzRkNGa2hNMlNIREpFbE1rVzJ5Rmk3RzhtYzVGNGxNOXlRMlI3SWZDOWtDUzlTSjBOV3M5Sk5nV3hKZ2VTNThZMGQ5K09aSXhrWTg5YnpHSDNrT1l4Kyt6bU1QdnJmaGgzN2I0eDJyTy82UU90TXpZODhweGdnQzJTQ2JDaEd5QXFaSVR0a2lDeVJLYkpGeHRxTmdoUGR0OGtVOXdXWjVZYk04MEFXK1NETGZaRFhraUhyVWlDYlVpQmIzZkNXMzRKZnZma2JqSDdyT1R4KytHazgvdFl6ZVB6SU0zajhiWXNkZlFhUE85YjNmR0RWbUpwVCs4TlBLeGJJQk5rZ0k0b1ZNa04yeUJCWklsTmtpNHlSdGM5dGs1SW15blEzWkk0SGt1T0JMR1hxNWZYY1pLUEsyZUpEU0g0eTd0azVDdjk1NkxmNDVjRXgrT1hoMytDWGI1bDI1RGY0cFdOWGp3KzA3bVRnNEJqRkJOa2dJN0xGWnpCRGRzZ1FXU0pUWkl1TWtiVkx0c2x4Q1RJMXNWbG11aUZaakg1ZXlLdGN4ZUtEdko0TTJXeWszbXNxaCtIbiszK05YN3o1bi9qWndTZndzOE1XZStzSi9NeXhxOGNIVnUwUFBxR1lJQnRrUktWaU1rTjJ5QkJaSWxOa2k0eVJOVExYc2sxT3ZGZW1KMzBpczkyUStZeCtYc2dxcjdFS1ltTXlaS3NQcmdJZlJqYWxxUjA5ZXVCWGVQVGd2K0hSUTZZZC9qYzg2dGpWNXdPdFAxazQ4Q3ZGQmhraEsyUkd5QTVYMHBBbE1rVzJ5TmowcEw4S21XdlpwaVNObDFlU2pEeTkwSE5wOUdQaHNjMk54UEtiOGFNOVA4TWpCLzRWb3c3OEhLTU8vc0t3UTcvQUtNZXVYaDlvRGc3OFhMRkJSc2dLbVZFRmlUVUtraTNPQmNrYW1WUGJBZ21UYVVuRmtwa0V5ZlpBbG5DSnRvNStQa2hlTWlUZmpVSGJ2NFdIOXYwY0QrNTdEQThlb1AwVUQ3NzVVeng0MExHcjJnZGtnQ3lRaVgyUEtVYklDcGxSN0d4a0hjRnVDcnNxSG9NeHNrYm15SjVNajd0QnBpZWVrcmx1eUFJM1pKa0g4cG9YOHJvUHNqa1pzczJMME9KVTNORjBQMzZ3OTU5dy83NkhjZi8rUjNEL0FjZDYwZ2ZmTy9BSS9HVmRHaGVaMlBld1lvU3NrQm15b3hnaVMyU0tiSkV4c2tibXlKNU1TN3hYWmlaK0lsbHV5Q0kzWklVYnNwb05SZVp4SS9yRmxkK0k3K3g2RVBmdCtUSHUyZnNqM0xQdkgzSFBmc2Q2MGdkM0gvZ2g3anlVWnB1TlBKU0diNy81ZmR5MS93ZjRibGUwSlJON2Y2UVlJU3RrUmtWQk1rU1d5QlRaSW1Oa2pjeVJQWm1XOUtSa0prSnlraUJMM0pCVkhzZ2FMMlNqRjVMbmd4UW1JYlg2Rm55bitRZTRhM2NhN3R5VGhqdjNwdUhPZlk3MWhBL3UycGVHa2ZzZndKMTdIOEFEOVk4Z3JlWW5lS0QyRWFSMXd4Nm9lUmpmcTNrSUR6WDhIRC9hOTM4d2N2LzNPNjh2bWRpVHBoZ2hLMlNHN0NpR3lCS1pJbHRrakt5Uk9iSW4wNU95WkhZaVpINGlaQm52alBKQVh2ZENObm1ORUZya3dRMTF0MlBrcnUvaGp1YjdjTWZ1KzNESG52dHd4MTdIZXNZSC80RGJEdHlGeDZwK2haekZPY2hhbElQc3BkbklYc3JYemx2V2ttemtMRnVBMXpldFI5M09ldnpIL3YvQ3JYdnY3THkrWklKc05OK0hPM2Q5VHpFalJSNkRJYkpFcHNnV0dTTnJaRzVHd2p5UlZ4STJ5cHhFeU1KRXlISzNjWHNlbDE1djhVTHlQWkJpSDI2cS93YSt1ZXU3R0w3cmJneHZ2aHZEZDkrTjRYc2M2d2tmRE4wN0VuZnN1aGNMOGhkaloza1REdXcrZ01QN0R1SFF2b05kdEVNNCtmWkpmUGJCMzFEd1hnbHUyM01YYnQxOVorZjFKUk5rWTlmZGloVXlRM1lVUTJTSlRQSFdUekpHMXNnYzJaT1pDUlV5THhHeUtBbXlJZ215MmdQWjRJRnM5VUlLUEFndFRjWlhkM3dEdDc5eEY0YnRHb2xoelNNeGJMZGpQZUdEb2J0SDRpdDdoK1BYVlUraHVYWVhMcngvSG5adDV6KzdnQjhlL2lsdWZPTTJETnQ5WjljMEpodTdSaXBXeUF6WklVT0tKVEpGdHNnWVdTTnpaRTlteHRWTEZnRk1OQUYwUXphNElWczlrQUkzK3BXbTRDdjFYOGVRcG0vaGF6dS9pYSs5OFUxOGJaZGpQZUdERzV0dnhSMDc3c1A2MGcwNGMvVDMrUFRUVCszaUR6TitQdzhER3dkajhLNi83N3ErWkdQbk54VXJaSWJza0NIRkVwbGF6U0tYQUNaQ01VZjJaR1ppazJRbFFKWWtHbzlxV01OMVhSNUluZ2RTYUFCNHcvWmJjWFBqTjNCVDAzRGN0SE00Ym5yRHNVRDc0TXR2M0k1cjN4aUM1OHBleHFIR04vR25QLzNKTnZoMi8za2ZoalIvRzljMjNkSTliY2xHMDNERkNwbFJBQmF5SCtneG1DSmJmQndJV1NOelpFOHk0NXNrbXdEeW1TeEprTFZKeGdwWExxMGhnR1hKdUc3N0VIeTU4VFo4cWZGV2ZLbnBWbnhwcDJPQjlvRjMxMWR4ViswREtDa3Z3Ym5UNS9DM3YvM05GZ0EvK2V3VC9NdVJKeEcvNDRidTYwbzJHbTlWckpBWnNrT0cxTFZocnBvbVcyU01ySkU1c3FkKzVDUkFsaVpDY2pXQWJ1TlNTaEVCOUNHMWJoQ3UyekVFMXpiY2dtc2JiMUZuQ3M4V3h3TGpnNVNtUVVocEhJU3BKYS9nMk82aitPaWpqMnlCangreTdnK2I0Vzc0TXBJYmIrNitubVNqNFJiRkNwa2hPMUprc3JUSmJRQkl4c2dhbVRNQWpHdVNuSGpJc2dSSUx1LzNURFFpSUsvbEZTVWh0TndMVCsxTlNLMGZoSlFkTnlPbDRXYWtORG9XT0I4TVF2K21hL0Q5eW9kUlgxV1A5OCs5ajgvd21TMEFudnZrUGR5eDl4OFF2VDBWcVkyRXZKdTZrbzBkTnl0V3lBelpJVVBxdWpBaklOa2lZMlNOekdYR01RTEdOY2w4RThEWEVvMmJqdmxtQWxoc0FKaFVleU84OVRmQlUvOFZlQm9jQzZRUFlodi9EcW4xZzdHZ2VERk9IenlGaXhjdjJnSWZQeVRqMUZUMHEvT29DR2pibU9xL29sZ2hNd3JBWWd1QXZLR2RqQkZBTW5kWkFEY25HWmRSaXBNUVV1WkJYTzNmSWJIK1MwaW92d0VKRFk0RnlnZnhEZGNqdE1HRHg4cCtpYjExZTNEaC9BWGI0R3Y2VTdOSzZ4SGJrKzNWdFA0R3hRcVpJVHNNWXVxU0hKbTZQSUJ4a0dYeGtOZDR0M3NpWkhNaUpEOUovYkdyekkzK05kY2d0dTVhRE5oK0xRYlVPeFlZSDF5SDBBWTNycThlaW5VbHIrUGRvMmZ3MTAvL2FndUFMRHgrZlBDZklUVXhpSzIvemw1TnQxK3JXQ0V6Wk1jQU1NbGdTZ0dZWUxBMlAwNUh3TmdteWRFQXhrUFdKVUEySlVDMkpVS0tFdUVxUzBKa1ZTcWlhd2NpcW00Z29yWTc1bThmUkc4ZmlJanRLWkR0Q1hpeStHbTgxWGpZMXJiTHF2ZldJYXcyRVdGMVhuQmZ0bzZuYnFCaWhjeVFIVEtrV0NKVFpPczFUdmZpb1pqTGpPVWNNTFpKU0NQL1oyNDdBSlltSXJ6U2g0aWFaRVRVSmlPaXpqRi8reUM4TGhsU0g0TmJLcjZKNHJJU3ZHZGoyK1hNeGJNWXN1c09TSFdVZ3R6MnNaQ1JtbVRGakt2VUNHS1hBRWpHeUpxS2dBckFBVTB5UHhheUxBNlNHd2RaRncvWkZBL1psZ0FwU29Dck5BR2hsVzcwcS9HZ1g2MUhUVm81Y1hYTWZ6NEkyWjZBZnJVSkdGYzBDU2YySExlMTdmTHNpYkdRcW40SXFYUDdSME15VXVOUnpKQWRNcVJZSWxOa2k0eVJOVEtYT1lBUmtBQU9nQ3lMTlFHTWcyeUtnMnlMaHhURlEwcmo0YXBNaEtzNkNhN2FKTGpxSFBPckQycVRJTnZETUxMc1B0Ulg3YkMxN2RMd3h5YkUxdzlVMFMvRVh6cVNFYkpTbWFqWVVReVJKVEsxemd4eVpJM01kUlJBcVVpQVZDVkFhaElndFk3NTFRZDEwWWlwOGlLbmFBSGVPZmdPUHJhcDdYTHhieGVSOXViRGtBcUIxQ2I2VDBjeVFsYklUS2taeEs0SVlNNFhSMEFId0VDZGRQR1F1bENNS240TWUrdjI0b1B6SDloUzlmSkRWcHg3RFNIVkVhcnk5ZXNKMUZFQXlWeExCRlFBRG9Ea3hrTFd4Wm9wT0E1U0ZBY3BqWU5VeEVPcTRpRTE4WkJheC96amd3UklYVGlTSzIvRW1wSjFPSHZzWGR2YUxtY3V2b3ZCYjl3T3FYU1prYytQR3BJUnNrSm15QTRaMm1aTzY4Z1dHVnMyQVBKNUFHTWd1UU1nNndhWUFNWkNpbUlocGJHUWlqaElWUnlrSmc1UzY1ajlQaUFRQXlDMVlYaWk2RGM0MHZTV3JXMlg5T012R3FtM0p0Yi8rcEVSc2tKbXlBNFoybVlHTmJKRnhwYkZXQUhzM3lRNU1aQ2xKb0JyQjBBMnhrTHlZaUdGc1pDU1dFaDVIS1F5RGxKdFFzaWRPR2F2RDJwRE1LanNOclB0OHA1dHExMVU0VkhuZzFTRkd4bk0zN3FSRWJKQ1pzZ09HU0pMWklwc0VVQ3lSdVl5KzdNS2RnRHM4Wk9wTmhxaDFmMHh0bWdDVHV3NVlWdmI1ZUpuRjVGMjRDRkl1ZGg3c253UnhGMERzTDhaQVdNZ2EyTWdHd2RBOGdaQUNnZVlFVEFXVWhrTHFZNkZNSXc3WnE4UGFnVWpTcitMSFRhM1hWYWN5MFVJSTE5MWxMM0grMFg2a3hHeVVtNW1UekpFbHNnVTJjbzFzMjFPZjJzRWRBRHNzWk9xTmh3eFZVbklMbHFBMzl2WWRsR0Z4ODViemJrZnAwd0JDaHlkQnpDNlNYS2lJVXY3UTNMN1E5YjJoMnlNZ2VURlFBcGpJQ1VESU9VRElKVURJTlVESURXTzJlZURHRWl0WUZUeG85aTczZDYyUy9yeEY4elUyeit3bXBFUnNrSm15QTRaSWt0a2lteVJNYkpHNWpLak9RZU1hcEtjS01qU2FFaHV0QWxnZjBoZWYwaGhmMGhKREtROEJsSVpBNm1PTWZwSU5jNHJWNUowejFqMWhpQzU0bnF6N1hMV3RyWkx3eDhiRVYvbmhWU0ZtdkIxOTFnNzhmZGtoS3lRR2JKRGhzalNSak80a1RHeVJ1YklubVJHbWdCR1FYS2pUQUNqSVhuUmtNSm9TRWwvU0hsL1NHVi9TRFhQSnNlNjd3TUt5bm1aQzA4VWpjYVJuZmExWFZUaHNmL0hsdWdYWUwzSUNGa2hNMlNIREpHbGpXWndJMk5MbzB3QUkwMEFzNk1nUzZJZ3E2SWdhOHczYjQyR0ZFUkRpdnREeXZwREt2cERxa3dJdVJQSHV1ZURHc0dnMHFFb0xpdkdlNmZ0YTd1c09KdUxrTW93byszU0V4cVJFYkpDWnNnT0dTSkxCSkJza1RHeVJ1WVkvTlFQQjhEdXdkUlpvV3ZDRVZvVmdiRkY0MjF0dTZqQ28ybW9FZjA2ZTB4MnZiOXJBRVpDbGtTYUVUQUtzakVLc2pVS1VoQUZLWTZHbEVWREtxSWhWZEdRYXNlNjdZTWF3WWlTNzJCSHRiMnJYZEtQUFE4cEUwaDFaTS9wUkViSUNwa2hPMlNJTEpHcE5XYVdKV3Zaa2RZSVNBQWpIQUFEY1hMVmhDS21NaDdaUmZOdGJidW93cVBXRGFsdzlSeDg5RitIQUl4b0MyQ0VDV0FrWkUwa1pHTWtaR3VrR1FHaklHVlJrSW9vU0ZXVTBkUmtZOU94THZpQWtZbHRsMGRzYmJ1b3dtUGZqOHpvMThQYWtCR3lRbWFLelN4S2xzZ1UyVnBsQnJ2c0NETUN6Z3B2a3F4d3lPSUl5TW9JeU9vSXlJWUl5SllJU0g0a3BDZ1NVaG9KS1krRVZFWkNxaHpybWc4SWhpQzU3RnFzS1ZtTHM4ZnNhN3VzT0xzU0lSWDlJSlg5ZWw0Zk1rSld5QXpaSVVOa2lVeVJMVEpHMXNnYzJWTS9IQUFESUZ3NHBFcndST0dUdHJaZHpsdzhnOEdOUTR6b0Z3ekJvZk1BaHBrUk1CeXlNaHl5T2h5eUlkeU1nQkdRb2doSWFRU2tQQUpTR1FHcGNxeExQcWhtMjJXSTdXMlg5S1BQbWZDeDlSSUUycEFSc2tKbXlFNittVTNKRk5raVk0dkR6UWdZeGdqWUhvQmhEb0IyaWxrZGd0REtNSXd0SEdkcjIwVVZIalZKeHZWZU80KzNPNTkxV1FERHZnakFNTWppTU1oS3Zpa01zb0VBaGtQeXd5RkY0WkRTY0VoNU9LU1NhY1N4enZrZ1RNMzlSaFRmWmV0cUY2UHcrQ0drVkNCVlp1TTVHTFFoSTJTRnpKQWRNa1NXeUJUWkltTmtMU3NNS3ZqSnJINU5rdFVQc3JnZlpHVS95T3ArSm9CaGtQd3dTRkVZcERRTVVoNEdVUjEyRHRheER2dWdXaEJURVd1MFhRN1pkNU9SVVhpRVFpcERna3NQTWtKV3lBelpJVU5iektCR3RzZ1lXU056Wk04QjBKOG5VeitqN1ZMMGtLMXRGNlB3dU1VeTkvUG5HRHI1MlowR2NHWm9rMlNGUUJhSFFGYUVRbGFIUXRhSFFqYUhRcmFGUWdwRElTV2hrTEpRU0FYUE9NYzY3SU1xUVhKcEt0WVUyOXQyU1QvNnJKRjZHZjJDVFE4eVFsYklETmtoUTJTSlRKRXRNa2JXeUJ6WlV6OCtCMkFJWkhNSVpGc0lwREFFVWhJQ0tRdUJWSERBamwzWkJ6eEpYWkJLd1JNRnY4YVJuVWRzdThtbzRmODFJTDQ2d2JqZXErQUxNajNJQ0ZraE0yU0hESkdsOVNFZEFaQnZNdC9zQU5pOWs2MUtNS2hrc05GMmVjZWUxUzdxNXZLOVA0Q1VTUGVPelo5QjVBc0JaSlkxczIxckJIUTFTWllMc3RnRldlR0NySFpCMXJzZ20xMlFiUzVJb1F0UzRvS1V1WXpyak9yTTV0bmRVYU96ZUlIY1pxdmk1M2IwR0FMOVBrRm9SYWp0YlpjVloxY2dwSnlaS0lqSHptdlJaSVhNa0IweVJKYklGTmtpWTJTTnpNMTBNUVZMazJRSlpMRkFWZ2hrdFVEV0MyU3pRTFlKcEZDTU00NnJMTlRBVGFBSVZRY3NxaW9hOFdYeENDOEtSMFJ4SkNKTG9oQlZFcVZlK2QrZE5mNXRWQWxYWExEOTBMRmo2TWh4MnZxZUtzR0lvcEcydGwxVTRkRXcySno3QmVtNHlRTjFJU3VNMG1TSERKRWxNa1cyeUJoWkkzTmt6NjhBVmdpdXJiMFdTNXFXWUVuZUVyeTgvR1U4di9oNTAxN0E4NHM3Ynk4c2VnSGpGb3pIZmEvZlowVFZZSU93U2hCVEZvUHN3aHo4M3NhMlMvclI5T0NITHhnQkRDMEx4Yk1IbndYT1F6MXNaOStPZldpdWJjYnVMaHIvdHFtb0NXdldyY1hOUllPTUtOaUZ5R3hyeE5PWndEeU9VWVdqYkcyN0dJVkh2QkZaOUw2QzliWFRFZkFWYVpKNUFsa2trRmNGOGp1QnZONG1CUmViWVpVM09ITUhuYkV5UVhSbE5QSXY1S3NIN2ZENTduLzk5Rk4xQXc0Zk9kdFo0N2NEL2ZHUGY4U1JOOTdHdEszVEVjV0ZqL3JNNjh4eCtlTzlsWUxra2hSYlY3dW9LeDU3MHlEVXdCL0hiUGRua2hHbVlCNnZOUVdUS2JKRnhzZ2FtU043Nm9jL0FlUUFTd1RER29maDdDZG5iWHZhMC9rL25FZHpWVE4rc3UzUjRBR3d3djYyeTRwM1Z5Q0ViWTJ1blB4Mnc5V1J6d3RLQUhsUXhZSXhiNDJ4RFVCR3pqUEh6aUN2TUErRG1JcDdPZ3BXQ2dZVkQwSnhlVEhlczZudG9ncVBIWU9OQ1gxSHhBK0c5d1FsZ0hSTW1TQ3lJaEo1ZjhpekRjSVBQL29ReDVxUFlWcGV6NmZpMEhMNzJ5NnE4T2d0cVZmREg3UUE4Z0IxS3I1b1h5cCsvdy92dDZaaTdZUWVlQjFSTk1MV3Rvc3FQUGljUGE1MjZZSHhkSG1mWFFKd3JrQVdDbVM1UUY0VHlEcUJiQkpJbmtBS0JGSWtoaU00dWVRT3VtTkZma3pGaFlNTXNicHpmRjM0MjVqU0dHUVgyZGQyVVlYSG5qVEQ3MTA0bm03cDA5MzlrUkdlTkdTRzdKQWhza1NteUJZWkkydGtycVVJQ1NTQXBZTEljaitsWWxiRnBXYVR1cnVPN01UZmp5cXd0KzJpQ285U1hsUHQ1c25laVRIWUJtM1FBMGluRkF1R05RekRXWCtrNHJ4SEF4Y0ZLd1RKeFNtMnJuWlJoVWY5WUtPTjBSTUFkWGVmdlFKQUhxUy9VbkZCSGdZRk1CWGJ2ZG9sL2UxMEkzMzF4dWhIZUhzRmdEelFFa0ZrV1NUeS9zY1BWYkZPeGRvaDNUMnJML1AzYlAvWTJYWnArS0FCOFpYeFJ0dmxNdnUwTFZYNjYvTTdEZUIwYVpJNUFsbGdUaEJ6QmJKV0lCc0ZzbFVnK1pZRkNaeGNjZ2QyV2FGZzZJNmgva25GV3g4MWlpVzdqclhONTRTV2htSnNnWDAzR2FuQ1kzZWFjZldnemI1czgzY2dQcGVNNklVSVpJY01rU1V5UmJaWWhKQTFNa2YyMUkrZUFwQUhXeWdZYzlnUERXcW00b0pCZm9Od1JLRzliUmRWZUhBUnA5MG5lU0Nncys2alZ3SElBeThXUkpiNk1SVno2UmJUamRWSjNmenZtQko3Vjd1b3dtUDc0TmE1WHplUHo4NnhkdnF6ZWgyQWRIWXZTOFYydDExVTRjRUw5NzA5K2xITFhna2dEN3FYcEdMVmRySHgyUzZxOE9DM0N1a1ZSNzA1K3ZWYUFIbmdySXA3UVNxMnMrMmk3dkhvQzRXSDlhVHBsUkZRRDRDcHVONlBWYkhlVHhkZjJWOVVqOVMxYWJYTGlqTXJFRkxNTzhqc25hTjJldDdXUlgrMHU1OHVBemhmSU1zRXNrb2dhd1N5UVNCYnpEWDl2S2JIRkVGSGNRZitNbjUrZ1orcllqcTdDOGNmV21LMlhmYmE4MDFHWno0K2c4RXNQT2piTGh4UDBQNE5OU1FySEJmdkJ5RkRaSWxNa1MweVJ0WSsxNFlKQmdBcFJKRWdzc1NQVmJGNjVIRG5SUjlSTU1MV1IrcW1IMGszUlBMM1NSMW91SHM5Z0hSWVFRQlNjU2VFaVNtMnQrMmlDbzl5ZnBsejUwK0VvSTE4MnA5OUFrQU9Jb2hTOGFoOCsxYTd0Rnp4Nkd1cHQwOEJ5TUg0T1JWSEYwVWJjNjhycE1Ea1FudFh1NmpDb3lqRW1DZHAwZnJTYTZjajREUnBrdG5teEhDcFFGYWFFMFo5Y3pvWEZQS2FIdE9GTGtTNGswQll2bURvZGo5VXhkWE5lSlRYaXE4MGhtTEJFL24yUGR0RlhmR29HMno0ODByNzdxMy9Ua2JJQ3BraE8vcW1kQlloWkl1TXNkNGdjMlJQL1FoV0FEbVlmTUdZUTM2NFZzeWJtYllOYW8yQzdRak9hOGwydGwxVTRVRmhBbjBpdHpPMks1NThYZjJiUGdVZ25WQW9pQ3oyVDFVOGZldDBYSktLTFU0UExRckYyUHh4T0dGVDI2V2w4TkNQT3JIc3kyOHc5TVErK2h5QWRHSVBwT0lSK2ZhdGRsR0ZSM05hMzA2OUd2WStDU0FIdFUwdzVxQi9VdkZnbllxNW54SkJUS0c5YlJkVmVQQlplWndiYWFINjZtdVhBTXdVU0k1QWxsaWVrTVZIS2ZCdUppNG8xRS9KMG9VSWR4Sm9LeEJFRmtVaTd6MzdWMUJQMzJLbVlrSlJMQmkxemI2Mmk3cmlVVHZZOEdHZ2ZkWVQreU1qK3BFY1pJY01rU1g5WkN3eVJ0YklYRXNSMGhzQXBETzNDWWJXRGNYWmorMjhyL2c4ZHZFUkg1dC9vcUtUSjkrTE5VVnJiUHNtby9TMzBnMzRldkxrRFNTSWZScEFEczRmcWZqNHU5aXdiUU8rdlBITCtPbm1uK0pRNDJGYkhxbXJDbyt5ZU9PU1d5QWg2TWw5OVdrQTZWaC9wT0lQUDhUaC9ZZVJXNXlMd3BvaW5EdlQvVWZxcXNKalY5clZrM28xOUgwZVFBNVVwMktiN2l2KzdMUFA4T2MvL3hubjN6MlBDLzl6QVI5Zi9MamJ6NjlSaFVlQldYaG9jYTZHMTA0RE9GV2FaSlpBc2kxRkNKL2p4a2NwOEc0bUxxZlJqK2pnNUpJN0NBYmJhbTlWVE9JK0E1OWUyUDJ0cGZDZzM0TEJWNEU4QmpMQzY5d2NPOWtoUTJTSlRQSHh2Q3hDeUJxWkkzdnFSMjhFTUY4UVdXaHZWZHg5OUl4UFNEK2NiZ2dRVENkc29DQzhhZ0NrUS9QTXF0aW1WR3dIZ0tyd0tJMDNtczZCRWoyWTluTlZBY2pCK2lFVmR4VkVWWGk4a1daRXYyQ0NJcERIY2xVQlNNY0dVU3BlOGZzVkNNbm5Od1JkaFNYMTZ1MEFBQWxFU1VSQlZITS9EWG1uQVp3aVRUTFQvTjRHZm44REh5S3RIOC9CdGZ4Y1RzTUpKVmR4Y0hMSkhRU2JiUlVNcmJXM1FkM1pLS2dLajVyQnhwV2pZUE5QSUkrSGpGaVhZcEVoL1ZnT3N0WDZIU0VRc3FkKzlIWUFPZWd0Z2pGdjJuZXR1TE1BcXNLRFZWK3ducVNCZ3ZDcUJKRE8zZFp6VmJFcVBFcmlqYVp6b0lRTzF2MTBDMEQ5WFNHOUxRVnJNYllJaHRiWXU0TDZTcEZRM1Z5K004M29lZW5qdUpwZnJ3UWdHVE8rcHN0TXdaUE1PU0MvSzBRL0oxcmZHOHhsK2RZVk1Yb2V5SjBFby9INE5nYzJGYTk0WndWQytKV2t3ZTZiUU9sRlAzRDFsRjRKUTRiMFBjSDYrZEJramRNK3NxZCs4SmUrQUNDZG5DZUl6QTlNZzFvVkh0V0RqZWdYS0lHRGZUOVhQWUFVS0VDcE9QMVF1dEVsY0tKZmEwWjBBRFRiQUg1T3hhcndLSTQzV2xUQkhwVUNlWHdPZ0swWHcvMlZpaThwUEFJcGJtL1lsd09ncFVEYUxCaGFiWCtEV2hVZVcwT015WFp2Z0NLUXg5Z2xBRjh4djdtR1ZiQitRaGJYOEhNdHYzVkpGcXNiN3FDM0dJOTNrMkRNQWZzYTFLcndxQnJjT3ZmckxiNEkxSEhTNTlhbFdQcCtFUDFrck5adlNiSlV3WDBWUURwOXF5QnlXeVR5enRsek01TXFQTmlhNm0wbm93TmdEMFpPbTFKeHc0VUd4QmZGR3oydVFBbmEyL2JqUk1CMlFMY2hGYXZDb3luTlNiMVhPaUVjQU5zQmtFNWpLbWFEdW91cCtKTEM0MG9pWE0zLzNpVUFaNWlQVExVK0paVkZpTDR2aEV1eTlBM3F2ZG01bXdSRHF6cGZGYXZDbzlJcFBEcFVmQkpBc2tKbTlQMGdaRWtYSWZyeHZHUk9YWXFiS1BVeTNRS2dma1FiYnlMaE9pNnU1K0trVzkrY3hCMzBWbU4xdGxFd1puL25xdUwwZyttR00vbjN2WFhzZ1RwdVhRR1RHYjBXa0N4Wkg4MW1QQjhhUXZaa2tsUmNBaUR2V3VLYit5S0FGR0dMSURLdjQ2bFlGUjZGOGNZSkdDZ1JlL04rdmdoQXNxVWpJSU1lMlpPSnN2RnpBUEwydWI0S0lNWFZxZmdLTnpPMUZCNU1KYjBaaWtBZSsrVUExTGRrV2dFa2V6SlI1c2swODRtVjFnY1U4ZXZWbVlMMWtpeW1ZRDBQRE9TQS9MRXZPcWtEcVZnVkhsdEMrczY0L2VITHRwOUpSc2dLVXpEWklVTmtTUU5JeG95bm96SUZaNG1NbHlkbHF2bTBJdDR3ekFXRFhMZkZSYWxjeDZXdmhuQlNxZWVCRkxDMzIyWkI1TlpJNUoxdHYwR3RDbytLd2ExenY5NCsza0FkUHhuUkJRalpJVVA2YTFySkZobmp3N0RJSE5tVDhYS3ZUSlZQMUozcVhLbXFBV1RWWXIwYzE5Y0FwQ0FiQlVNcjI2K0tWZUhCU1RUUDZFQ0oxeGYyMHhaQVhRRXpxT25WME1aVEVUNVI3TWw0dVVHbXlxbVdPK09zcTZKMUs4WmFDZmNsUVRpV0RZTFIrMGRmc3ZLKzRYd0Q0Z3ZpalRPNUwwQVJxREZZMHkrWllSdlBDaURaMHN2eHlSelprd1VTSnBPa1dIZzlXSytLdGk1STRJZTBuUWNHYWtDQjJJK1ppcmVlM2FvZ1ZJVkhZNXJSUWdqRS92dlNQcXdBa2hrcmdHU0tBSkl4c2tibU1pUmMxRFpKeGdzYmczUE5yMU52Mnd2c3l3QVNnSTJDWVpYRDhNRW5IMkQ5bWZVSTJXd1dIbjBKamtDTXBTMkFMRUNzUGNBRkptTkdFM3E4QVI5L1RwWjdaYnI4dGVYN1FuanpNS3NXYXlYTVZnVG5nZHhKSUFZVHlIMXdUSnNGaisxNkRGK3YvcnBSd1FWeS8zMWxYNllmZVVKL3JnSW1VMnpCc0FJbWEyU3VaWnNzQ1RKVm1pOWJpRENVdHAwSDlrVVErMktoRlFpNHlRSk50MS9hbS85ZFdvQTBDNW03Wkpza0UxVnVaaG9tcWV4YXQ0MkMvR0F0RW5lbWQ5eFhYdnZpbUFLaERmMUdJeHRrcEwzK0g1a2lXOGI4YitJbDdLbGZKc3B0TWswdXFCREpacUgxT1RHNkg4Z1AxNm5ZRWF2dm5ZQmRoVlhEUnpiSWlMWC9wNThIMDlxQXZpQms3WE5iaG9USVZGblZrb1pac2JCeXNWNFhKdGw5UFFwMlZZU3I5ZTh1Ri8xMDhhR3JYN1pmalA3ZktpRnI3VzVUWktUTWtJL1V0MW0zVGNPTWdub3U2RVJCSi9ycEU2NXQ5Q01qWk1WNitZMHNjUVVNMlNKamw5MUk1alI1dGQwb3FDdGlobGRHUVY3clk4N1hjMEo5UU03cjFRR25Cby82NjZWWFpFTmYrMlhtYkJ2OXlOWmxvNSttY29vTWtSbHlUaEdyNTRLOGpLSXZ6ZWtGQ295Q09oSmFRZFFoMlhrMUp1WjkwUTlhYjc1cURuVGhZYjN5d1RxQ0RCblI3NXlRclE1dFV5VmRSVUYycmRrODFJMXBSa0dkaXJsRDdyeHRKT3lMRG5mR2RPbkpwQUdrOW1TQUxGaFRyMTU4U25iSWtESDNTKzhRZStwTkdSSWowNlM0cFNKbUQ2ZHRRYUpUc1FQaHBlTDBkVmpid3Flclh1dFZEN0pDWmxvclgxNTJpK2s0Z0h6bkZCa3FNK1cwNnQxd0VzbHdxbE94WHF4cUxVcWNTTmozUVd3UFBqS2c0ZU0wall6b3F4N3MrNUVoc3RTbGJabzhKSm55RjdXQ1FhZGkvUXhwNW5ydXVDMkVEb2g5RDBRcmVEcnRNdkpwK01nQzEveVJEVTdYeUFyYkxtU0hESFZybXk3UHFGVE1oWVRzRFhJSHZFTENIV29JcmVuWVNjbDlDMEFyZk5TV1prMjdHajR5UVRiSUNGbmhOZDlYNU9sdXNkZnl4ek5rYkljZzFJMXFEYUVURFhzdmpGYndyRkdQR3V0Mnl4ZkJSMlpzM2RxRGtDR1hlWjl6UWxiSFRNazh1UFpBdE1MSXdYR3lyZ2ZwdlBhc0w5cHFRYTIwNllobkJZOWFVM05xcjlPdU5mTFpEcDhtZWFaS3h4KzJ6QW01WUlHVFRwYmRiTkh3b0hSYTV2eUFCNjFoWk5qV2tWRy82a0U2cjYyQzk1UXZ0Q1lhT09xbDliUE85YWd4dGFibTFKNE02RG5mYlBsUXlJaGZ0NW55RTVrdHgxc2daTVhEc3B0ekFKNFJHa1FkRVhud09pcGFZZFJBY3NDTzlhd1BxSVUyRFIwMTArRHBpRWR0cVRHMXB1YlV2aFcrNDBJMkFySzlJcmRLcGhTcUppTjdQZXo1Y0FMS002SXRpSXlJVmhnMWtGWW85YUNkMTlhb0UwaGZVQXNObkJVNmFxY2puZ2FQR2xOcjNlZGpvNWtza0ltQWJsTmxnR1RLc3pKWDNsRlZEODhFbmhGdFFXUzFyS09paHBGQWFpZzViOVR0SEE3ZXNjRDRRUHVkcjFvUHZscWhvM1p0d2ROUmo1VXV0U2NEWktISHRsbHltOHlXNVRKWFBsU2RiMDVHTllnTTA1eWtNaXB5enNBQldZSGsyYVdOQTNjc2NEN1FmdGV2REJKYUgycEZ6YWdkTldSUW9hYlVsaG1QV2xOemFoODAyMnk1VytiSUtwa243N2RFUklacFRsSTVBQTJqRlVnT2xHZFlXOU9PY0Y1Ym9iRERGMjM5ek4rcGdSVTRLM1RVamhveXV6SGlVVnRxVEsyRGRzdVU0VEpIeHNzY2FaUnMrVmlkTVJ5QWpvdzhrNnhRY2s3UjF1Z0V4K3ozUVZzLzgzY2Q0YWdKdGRHUmpwb3gybEZEYWtsTnFXMnYyV1pKdk15UmU5V0J6NU1DbVNjbkpVditvZ2JGYThzY29EYkNhVFdlZFk3Wjd3T3JqL25mMnY5OHBTWUVMa3MrVmxwUk15T1EzQ3ZVc2xkdnZBRjVydHdnYytRZW1TT2paWTVreXh6WkpIT2xVdWJKRHNtU25aSWxUWTRGMUFjN2xlK3BBYlV3TktFMjl5cXRXbTRhOXk5NS94K1lGVDl3ZDBlaDhRQUFBQUJKUlU1RXJrSmdnZz09XCIvPlxuPC9kZWZzPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIGZpbGw9XCJub25lXCIgaGVpZ2h0PVwiMTYwXCIgdmlld0JveD1cIjAgMCAxNjAgMTYwXCIgd2lkdGg9XCIxNjBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+XG4gIDxwYXR0ZXJuIGlkPVwiYVwiIGhlaWdodD1cIjFcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIj5cbiAgICA8aW1hZ2UgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB0cmFuc2Zvcm09XCJzY2FsZSguMDA2MjUpXCIgd2lkdGg9XCIxNjBcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBTTlVbEVRVlI0QWUzZFM0L2IxaFVIOEROQW9vWGJqV1VnZ0ZjQnNrbFdRV2JWSWtCaUxRSWo0OGtnQ0pCdlVmZmgxZ3VqWGRRcHh1TytQMEs3NkJjbzhpMjZTR3AzMFhlYkFFVnJKM1ljdjhiMnpEaSt4Wi9EUDAzUlE1R1U3aVhQa2M0QXhCMVJGSG52T1Q5ZVhsSVNKWkx3YjM5ajQ1dGZ2ZmZlaFRDWlBKZHdNNzdxQkJGQXpwQTc1RERCNnRPdk1wdysvY3BYR3h0WEg1ODVFdzdlZnZ0eStpMzZGbUpHQURsRDdwQkQ1RExtdXBPdmF3LzROamMvT25qMTFYQnc4bVI0L01ZYjRXQno4MUx5RGZzR29rUUF1Y3B5ZHZKa1FBNlJTK1EweXNwVHJ3UVZQUUMrOWZXd1B4cUZmWkd3ZitKRU9KaE1IR0hxNEVkWVAvQWhWOGhabHJ2UktDQ1h5S2w2aEdWOEI4UUhnQ0xoWUR4MmhCR0FwRndGOFNGWEdUN216Z0xDV2ZqWUdFZVlrczlpNjY3RFYrUk9NOEkyK0lxR2VFKzRtSlFFcjI3Q1YrUk9JMExpMnkrUCtmS3VteFYvcG5TRUNSak50MHJpMjY4Y2RwL0pHWE9Lb1pXV01XRVozOTVvRlBaRVdrOW9zSitZekljbTFxdksrTHJrRHJrZUhPRWkrSXJHT3NKWWxqcXZoL2oyeHVQV25VYVJOM1EwUXlLTWdvKzlwU1BzakdmUkZ5eU1qN2tiQW1GVWZHeUlJMXpVVk92WFI4UEgzUFdKTUFtK3ZDRStKbXh0YU80RmlRK3huanFjRXRPOFpSOElxL2dlelZ2Wm10ZGw2L09lY0c1Y1RTOGtQb3o1a3VRdUpVTGcyOGRiTWV2cjRkRm9sRFVBalVneElVRDdrMG5ZOC9lT20weTFmaDZ4ekdLYTQwdVJ0MnlkdUJLQ3kzRXgzN2JyRTE4UkdFZllHbGZUZ3NUM0tEVStka2d4RVE2Q2p3MXhoRTIyR3AvdkhSOXpGd01oOGVHQ1krckRidEh6c1FGNTZZZmpSbU8xQ3hBZngzeDFNVTQyUHg4VHpuVTRKcjQreG55TkFmQ2VzQlpaM1JQRTE5dGh0OUp4RkRtZHB5Y0V2cjM4aE9QaGFCUWVpZ3crSVpCN2ZtSlM1MjFxUHZBaFZvaVpodHpCRURxeXpGVFRoMXFKNzlINmV0Q0NqMEYwaEZQT2pueWdEaDg3TDF3NWFVS29HWjhqUE5MYjFFeTErTm9nM052YXlnNjdHbnMrNG1QcFBlR1V1K3lCZW54SElkemFPdnlPU1hqenpkZkRtVE5YbnJ6Mm1yckRMdEZWUzBmNEZLRVpmQ1dFc0FaenNDY2ZIai8rd3c5UG5BaWZQUDk4Q1BsQ0Q3aXc1aElYVmxmOHhBVDRFSU9IV2s0NFpuaWhLUmlETlppRFBia284dlh2aWx6K3RVajRWR1FLSVY2a2VVTGdzd1NzNE50MkQwdjROT2VJZGNOUkRQaGdETlpnRHZiWWw2K2RGOWx4aEF5SDd0STZQbGdUa2JWcWxCMWhOU0lLSHk4clBvYTZRUGlKSDQ0WkV6V2xWWHl3aEtOclhjOVhEZkFVd2lmNU9IQlgrWGd3RzJ0Z01JNUIrUktPQ2RFbXRPM0JlS3g2WEk0ODBBcnNkTVZIakJuQ1g0bUVmNHVFTWtLc1hQT0VCQzBid2pJK3piRm4zWUFRWm1BSGh0cjJmTVRIMGhFeUVnT1dxNHFQSVRlTjBQb2xHdUJERzlDcnMzZlJYTWJxK1lpUFplMllVSE13c3JvWlBoeXo1OXMxaG0vZU1SK3gxWlZUUGVGWCtUand2a2pRUGlHQjFzYUVaWHphNDR2NllXZUhpVVhIZkhYNE9IL3QreUk3UERHeGh2Q0JrYk5qNEVOZHNlTll4QWNqUjExa0pxSkZTMGU0YUFSbnZON3h6UWhPNlNuVENMVWVqcTBmZGxQM2ZDVi8yYjhGd24vbHgzK01BeXdjTXU3alFxNnl3ekY3UHRUTlFndzU1a1B1TVNUckd4OHhUaUY4bkFPOEp4SzBUMFM0cStBZEU5UUJPd1RxcEQxdXFCOTJFT1I2YUh4VENIOHBFdjZaVnd3Vk5CRklYTjdBWUg5QWhOZzI2bUFOSDNLTm5BL1Y4eEVmeStJU0RmWUthejNoVUFpdDRtUFBOKy9iYTBRVHV6U05NTHZzMFdOUGFQMndxdzBmTVdjSUxSNk83K1VuSm4wY2pva1AyelF4Vk1tUGFqenNhc1ZYSU1TNGdBZ1A4dkhnWFpHZ2Zlb0RZUm1mOW5pZ2Z0aEJrRVBpMHpMbUk3YTZNanM3L29WSStFZmVBRFRFUk1BVDlvUlc4U0dIeUtVVmZFU1pJZlNlOERBY1Z2Rlo2L21JajZVakZKSGR6YzF0bk9UZ0VHL2lLR0Qwc0V0MDFkSTB3a1V2MFFBZjFtRU5IdzY3bXE3elZWRjFmVndnUk1Qd0N6em9DZTRZbU80dWNMR2ErTEFPRTIzTmMyTjF6TmVFTWtQSUU1TmxSMmdWMzkrTm5uQTA0ZVB6SzRIUThUSGRPc3VsUm1nVjM3SWVkdXQyQWRNSTc5ZDhnQUg0OEp5UCtlclNybXQrZ1JEakR2eHFEd2JxdHcxTWQvQ1pQWnpabHQ0N3ZyZXhrZUhEY3liYWtNZDgyY2Q4VGVRemhEOFhDUllSM2p0MUt1eSsvLzZQTWVGL2kvZ1FlMnZ2Y0RTaDZ2cThhWVM3Nzd3VE1EbStybW5YdGJ4ZGhNZU9oVHZIanBrNzdIclA5K3dPVUNEOG03RXhvYVV4SDJMcitKN0Z4emxUQ1BGakowanVsejR0RkFQRUVMRjBmR1EydTNTRUVYYzR4emNiVzkyempqQUNRc2RYeDZ2ZGZFZTRBRUxIMXc1WjAxSUZ3ci9tNHhnRTFzZUVzMk5BZklpWm4zQTBFV3QrZnUxN0lqcy9Fd2tJS0c3MUQ0QzNmRG95Qm9nTllvUllJV2FJWGNvYkJUV25iem1XY0lRdGRqakhseGE3STV5QjBQR2x4Y2UxTzhJakVEbys4dWluZElRbGhJNnZIM1RWclJRSS81TC9kZ2xPU3I1WXNRbHR4azNCRVFNLzRhZ1NTZjk0cFJFNnZ2VEEybXhoSlJFNnZqWTArbHRtcFJBNnZ2NWdkZG5TU2lCMGZGMUk5TDlzZ2ZEUCtlOVc0S1RrNWhLY21MQU51Qzh6MnZaVGY0ZWpmMTB0dDVnaFJJS3FDSkZFcXhOMkpNZlhVb0NDeFpZS29lTlRJR3FPS2t3aHhFM1RlVGkyMUF1aXpxaTdIM2JuRUtEZ0pXdmZFdG41UUNUOE1mL09zU1Y4cUN1K0o0MjZvdzFvaTMrcVJZR3FybFc0T0JyOTVQY2lUNUJRUzcwZzY0cTZvdzFkMiszTEs0bkF0Vk9uUHJqKzRvdFBQaGNKTjR4TnFEUHFqallvQ2FkWG8wc0VkcmUydG5mZmVpdmNmdUVGYy9pNHM2RHVhTVB1dSs5ZTZ0SjJYM2JnQ056ZTNOeitjaklKTjhkanMvaUlFRzFBVzI2WDdrVXpjSGg5ODdNaXNFejRIT0dzVEN0OER2aHVMMG5QUjN3czBST2liZDRUS29TSEtwVjdQb3NuSFlSV1Y2Sk5mamhXanUvR2VCeVFxR1dlMEVZZkV5cUN5SjV2RmZCeHgzS0VTZ0N1SWo1SHFBZ2ZCdVdyMVBNUkgwdTAzVTlNQmdESm5nK0RjaVpqVlVzL01la1pJUERkbWt6QzUrTngrRXpFSjV4MGpjY0JNZkZMTklreE9yNzZIYzRST3I3QmUyTkhtQWloOTN6MVBWOTFHT0lJSXlOMGZPM3hFYU1qaklUUThYWEg1d2dqNGJ1MXVibjlSWDYyZXgwZnp2U3Bjd3pRRXlLR3QveWpYTjFVRXQ5bjQzSG5vRHZVNlowVk1YU0VIZnc1dm1sQU1YWW9SOWdTb09PTGo0K0FIV0VEUW92NCtGVlBKbGw3NlFockVGckRoek5OZkhYeTAzekMvNWluSFNEcTV3Z3JDQzNpdzI5eFhNM3ZUSXE3aytKL3pIT0VsZVJxZjFqR2QwMGthSi9RZ3dEYW4wVENqa2c0SzNJUkUvN0hQRHlIWmJTM0EvVmIrWjdRS2o3MGRwZEV3bmNPYjVlUjdlUDRIL1BZRXhwRXVLMjlzNHBhUDh2NDBOdmwrTlpLUVZuRFBEem5DRXRSMGZqdkV1SmptQjBoSTZHMVhHSjhETGtqWkNTMGxTdUFqeUYzaEl5RWxuS0Y4REhranBDUkdMcTBpQTgvZ1ZVNTJ5MmZjTFFOYVlhUVo4ZFlwNThkdHcxZHBPV0k3OXA0SFA0bm9uN0M5VEhpMno2OHpyZm9uVW5Yem9yc1lGMEFqWFZqR3laaThmUlRORFl2MFFEZnpja2tYRGVHNzRwSWlJU1B1M0dCRU91MmhCQzVRdzZSU3piR1JHa1pIdzZaNkxVaTM1TTVRNGgxTzhMRWhCMWZiWUFkWVcxb0lqM2grQm9ENlFnYlF6VG5BbzZ2ZGVBY1lldFF0VnpROGJVTTFOUEZIT0hUV0N6Mm4rT2JPMzZPY083UTVTKzBpQTgvZTRvejBVUm51MTFET29VUWRiTnluWER3U3pRMzgrdDh1TWo4WHhIMUV5NytLc05Ick04Z1JGMHR4QlM1eDNWQ1dHQmplaW14d1J1VFNiQ0VEOS9id0crdlJiN0lIQ3ZlR1VMVURYVkVYUzBoaElYZUVGckV4NTVQS1Q0aUxoQmlpSUE2TzBLR0ppOGRYeVVnOFI4NndycVlPcjY2eUVTZjd3aXJJWFY4MVlna2Yrd0lHV0xIeDBqMFhqcEN4OWM3dXVvR1Z4ZWg0NnRhR096eDZpRjBmSU5ocTl2dzZpQjBmSFVHQnArLy9BZ2QzK0RJbWlxd3ZBZ2RYMVB1MVR5L1hBakQ2ZE5mMjkzYXVvU2ZlckwwM3E2UnQ5ZFNxVFdORU5aZ0R2Yms0NWRldXZEeHl5K0gveHcvbnQzZlR2dW5NTXFmYWxIKzNtNHFmRnl2U1lTNGh5S3N3UnpzeVk5RVhqOG5jdVczZUVJazRDZmp0U0owZkxSWGxLWVF3aGFNd1JyTXdWN1drck1pcjN4YjVLUGZLRWJvK0FwMDFYOU1JQ1ErR0lNMW1KdHF5QThVSTNSOFU2azY2b0ZxaEZWOHNIWlVJMFFqUXNkM1pLcU9tcWtTWVd0OGJKRW1oSTZQV1dsZHFrTFlHUiticVFHaDQyTTJPcGNxRU02Tmo4MGRFcUhqWXhibUxnZEZ1REErTm5zSWhJNlAwVis0SEFSaE5IeHNmcDhJSFIrakhxM3NGV0YwZkF4REh3Z2RINk1kdmV3RllUSjhERWRLaEk2UFVVNVdKa1dZSEIvRGtnS2g0Mk4wazVkSkVQYUdqK0dKaWREeE1hcTlsVkVSOW82UFlZcUIwUEV4bXIyWFVSQU9oby9oV2dTaDQyTVVCeXNYUWpnNFBvWnRIb1NPajlFYnZKd0xvUnA4REY4WGhJNlBVVk5UZGtLb0RoL0QyQWFoNDJPMDFKV3RFS3JGeDNET1F1ajRHQ1cxNVV5RTZ2RXhySFVJVi93TFJBeVA5bklLSVc2U2lhOW1tTUhINkZZUjN0VjlaMUpXMjh2RENCUUljYWRXNUE3ZjRlREg2SkZiRTRFaXd0K0poRCtJaE10cGZ2N0tSQ3dNVmpKRGlKd2hkOGdodnNOaEJoOERqZ3FmRjdsNjRmQWJVSmNqLy9ZYU4rTmxtZ2lzblJPNWpOd2hoK2J3TVNiblJiNXhUdVRDUlpIbk9NOUxHeEZBenBBNzVEQmxqZjhQTmhXUUQ4TnhsdGdBQUFBQVNVVk9SSzVDWUlJPVwiLz5cbiAgPC9wYXR0ZXJuPlxuICA8cGF0aCBkPVwibTAgMGgxNjB2MTYwaC0xNjB6XCIgZmlsbD1cInVybCgjYSlcIi8+XG48L3N2Zz5gO1xuXG4vLyBEYXRhIFVSTHNcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIERPV05MT0FEX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBTVUNDRVNTX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRVJST1JfSUNPTl9TVkdfUkFXLFxuKX1gO1xuIiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2NvbnRlbnQvc3R5bGVzLnRzXG5pbXBvcnQgeyBET1dOTE9BRF9JQ09OX1NWR19VUkwgfSBmcm9tICcuL2ljb25zJztcblxuY29uc3QgU1RZTEVfSUQgPSAnY3FkLXN0eWxlJztcbmNvbnN0IFNQSU5ORVJfU0laRV9QWCA9IDE2O1xuXG4vLyBTaG9ydGVyIGR1cmF0aW9ucyBmb3Igc25hcHBpZXIgZmVlbCAofjEyMOKAkzE0NG1zKVxuY29uc3QgVFJBTlNJVElPTl9NUyA9IDE1MDtcbmNvbnN0IFRSQU5TSVRJT05fU1RSID0gYCR7VFJBTlNJVElPTl9NU31tcyBjdWJpYy1iZXppZXIoMC4yLCAwLCAwLCAxKWA7XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3RTdHlsZXMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChTVFlMRV9JRCkpIHJldHVybjtcblxuICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gIHN0eWxlLmlkID0gU1RZTEVfSUQ7XG4gIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgIDpyb290IHtcbiAgICAgIC0tY3FkLXRyYW5zaXRpb246ICR7VFJBTlNJVElPTl9TVFJ9O1xuICAgICAgLS1jcWQtY29sb3ItcHJpbWFyeTogIzFhNzNlODtcbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMzNGE4NTM7XG4gICAgICAtLWNxZC1jb2xvci1lcnJvcjogI2UwNTk1MjtcbiAgICAgIC0tY3FkLXNoYWRvdy1iYXNlOiAwIDBweCAxMHB4IHJnYmEoMTUsIDIzLCA0MiwgMC4yMik7XG4gICAgICAtLWNxZC1zaGFkb3ctaG92ZXI6IDAgMTBweCAyNHB4IHJnYmEoMTUsIDIzLCA0MiwgMC4zMCk7XG4gICAgICAtLWNxZC1zaGFkb3ctcGlsbDogMCA4cHggMjJweCByZ2JhKDE1LCAyMywgNDIsIDAuMzApO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3M6IDAgMTJweCAyOHB4IHJnYmEoMjQsIDEyOCwgNTYsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3Mtc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI0LCAxMjgsIDU2LCAwLjcwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1lcnJvcjogMCAxMnB4IDI4cHggcmdiYSgyMjQsIDg5LCA4MiwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDIyNCwgODksIDgyLCAwLjcwKTtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogQmFzZSBidXR0b246IGNpcmNsZSDihpIgcGlsbFxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0biB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDUwJTtcbiAgICAgIHJpZ2h0OiA4cHg7XG4gICAgICB6LWluZGV4OiA1O1xuXG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcblxuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgd2lkdGg6IDQwcHg7XG4gICAgICBtYXgtd2lkdGg6IGNhbGMoMTAwJSAtIDE2cHgpO1xuXG4gICAgICBwYWRkaW5nOiAwO1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuXG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItcHJpbWFyeSk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctYmFzZSk7XG5cbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcblxuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG5cbiAgICAgIHdpbGwtY2hhbmdlOiB0cmFuc2Zvcm0sIGJveC1zaGFkb3csIHdpZHRoLCBib3JkZXItcmFkaXVzLCBwYWRkaW5nLWlubGluZTtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgcGFkZGluZy1pbmxpbmUgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3JkZXItcmFkaXVzIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm94LXNoYWRvdyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIHRyYW5zZm9ybSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJhY2tncm91bmQtY29sb3IgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC8qIEhvdmVyIChJRExFIG9ubHk6IGRvIE5PVCB0b3VjaCBlcnJvciAvIGxvYWRpbmcgLyBzdWNjZXNzKSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuOm5vdCguY3FkLWxvYWRpbmcpOm5vdCguY3FkLXN1Y2Nlc3MpOm5vdCguY3FkLWVycm9yKTpob3ZlciB7XG4gICAgICB3aWR0aDogMTIwcHg7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctaG92ZXIpO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpmb2N1cy12aXNpYmxlIHtcbiAgICAgIG91dGxpbmU6IDJweCBzb2xpZCAjZmZmZmZmO1xuICAgICAgb3V0bGluZS1vZmZzZXQ6IDJweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjphY3RpdmUge1xuICAgICAgYm94LXNoYWRvdzogMCAycHggNnB4IHJnYmEoMTUsIDIzLCA0MiwgMC4zKTtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgwLjk3KTtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogSWNvbiAmIGxhYmVsXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtaWNvbi13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1pY29uIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICBoZWlnaHQ6IDI0cHg7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoXCIke0RPV05MT0FEX0lDT05fU1ZHX1VSTH1cIik7XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHRyYW5zZm9ybS1vcmlnaW46IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm9yZGVyLXdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tc21hbGwge1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE2cHggMTZweDtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tbWVkaXVtIHtcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLWxhcmdlIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAzMnB4IDMycHg7XG4gICAgfVxuXG4gICAgLyogTGFiZWw6IGhpZGRlbiBieSBkZWZhdWx0IChjaXJjbGUpICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4gLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWFyZ2luLWxlZnQ6IDA7XG4gICAgICBtYXgtd2lkdGg6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIG1heC13aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIG1hcmdpbi1sZWZ0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAvKiBTaG93IGxhYmVsIG9uIChleGNlcHQgZXJyb3Igc3RhdGUsIHdoaWNoIGhhcyBpdHMgb3duIGxvZ2ljKSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuOm5vdCguY3FkLWxvYWRpbmcpOm5vdCguY3FkLWVycm9yKTpub3QoLmNxZC1zdWNjZXNzKTpob3ZlciAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtd2lkdGg6IDExMHB4O1xuICAgICAgbWFyZ2luLWxlZnQ6IDRweDtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogU2hhcmVkIHBpbGwgc3RhdGUgKGxvYWRpbmcgLyBzdWNjZXNzIC8gZXJyb3IpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1sb2FkaW5nLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXBpbGwpO1xuICAgICAgY3Vyc29yOiBkZWZhdWx0O1xuICAgICAgd2lkdGg6IDE1MHB4O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1sb2FkaW5nOmFjdGl2ZSxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzczphY3RpdmUsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmFjdGl2ZSB7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXBpbGwpO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiBMb2FkaW5nIHN0YXRlXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1sb2FkaW5nIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogMTJweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZzpob3ZlciB7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXBpbGwpO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiBTdWNjZXNzIChncmVlbiBwaWxsKVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyB7XG4gICAgICB3aWR0aDogMTQwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzOmhvdmVyIHtcbiAgICAgIHdpZHRoOiAxNDBweDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmcpO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiBFcnJvciAocmVkIHBpbGwg4oaSIHNxdWlyY2xlKVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuICAgIC8qIEJhc2UgZXJyb3IgcGlsbCAobm8gaG92ZXIpOiBzaG93IFwiRXJyb3JcIiB0ZXh0IGNsZWFybHkgKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3Ige1xuICAgICAgd2lkdGg6IDkwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItZXJyb3IpO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1lcnJvcik7XG5cbiAgICAgIC8qIGdpdmUgdGhlIGJ1dHRvbiBjb25jcmV0ZSDigJxmcm9t4oCdIHZhbHVlcyBzbyB0aGV5IGNhbiBhbmltYXRlICovXG4gICAgICBoZWlnaHQ6IDQwcHg7IFxuICAgICAgbWF4LXdpZHRoOiAxNTBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDQwcHg7XG4gICAgICBwYWRkaW5nLXRvcDogMDtcbiAgICAgIHBhZGRpbmctYm90dG9tOiAwO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcblxuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgd2lkdGggdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBwYWRkaW5nLWlubGluZSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIHBhZGRpbmctdG9wIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgcGFkZGluZy1ib3R0b20gdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3JkZXItcmFkaXVzIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm94LXNoYWRvdyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJhY2tncm91bmQtY29sb3IgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICB0cmFuc2Zvcm0gdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBtYXgtd2lkdGggdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBtYXgtaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3IgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWFyZ2luLWxlZnQ6IDhweDtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgZmxleDogMCAwIGF1dG87XG4gICAgfVxuXG4gICAgLyogRXJyb3IgZGV0YWlsIHRleHQgKGhpZGRlbiB1bnRpbCBob3ZlciwgYnV0IHByZS1sYWlkLW91dCkgKi9cbiAgICAuY3FkLWVycm9yLWRldGFpbCB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gICAgICBsaW5lLWhlaWdodDogMS4zO1xuXG4gICAgICBtYXJnaW4tbGVmdDogMDtcbiAgICAgIG1hcmdpbi10b3A6IDA7XG5cbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3JtYWw7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoNHB4KTtcblxuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIHRyYW5zZm9ybSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIG1hcmdpbi10b3AgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBtYXgtaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAvKiBPbiBlcnJvciBob3ZlcjogcGlsbCAtPiB0YWxsZXIgcm91bmRlZCBzcXVhcmUgd2l0aCBmdWxsIG1lc3NhZ2UgKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIge1xuICAgICAgd2lkdGg6IDM1MHB4O1xuICAgICAgbWF4LXdpZHRoOiAzNjBweDtcbiAgICAgIGhlaWdodDogNjBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDYxcHg7XG4gICAgICBwYWRkaW5nLXRvcDogOHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE4cHg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vcm1hbDtcbiAgICAgIGdhcDogN3B4O1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1lcnJvci1zdHJvbmcpO1xuICAgIH1cblxuICAgIC8qIENyb3NzLWZhZGUgbGFiZWwg4oaSIGRldGFpbCAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtd2lkdGg6IDA7XG4gICAgICBtYXJnaW4tbGVmdDogMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1lcnJvci1kZXRhaWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDYwcHg7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIFNwaW5uZXIgc3RhdGUgKGxvYWRpbmcpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtc3Bpbm5lciB7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgd2lkdGg6ICR7U1BJTk5FUl9TSVpFX1BYfXB4O1xuICAgICAgaGVpZ2h0OiAke1NQSU5ORVJfU0laRV9QWH1weDtcbiAgICAgIGJvcmRlci1zdHlsZTogc29saWQ7XG4gICAgICBib3JkZXItd2lkdGg6IDNweDtcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIyKTtcbiAgICAgIGJvcmRlci10b3AtY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3JkZXItcmlnaHQtY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3gtc2hhZG93OiBub25lO1xuICAgICAgYW5pbWF0aW9uOiBjcWQtc3BpbiAwLjY1cyBsaW5lYXIgaW5maW5pdGU7XG4gICAgfVxuXG4gICAgQGtleWZyYW1lcyBjcWQtc3BpbiB7XG4gICAgICBmcm9tIHsgdHJhbnNmb3JtOiByb3RhdGUoMGRlZyk7IH1cbiAgICAgIHRvIHsgdHJhbnNmb3JtOiByb3RhdGUoMzYwZGVnKTsgfVxuICAgIH1cbiAgYC50cmltKCk7XG5cbiAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzdHlsZSk7XG59IiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2luZGV4LnRzXG5jb25zdCBDTEFTU1JPT01fVVJMX1BBVFRFUk4gPSAvXmh0dHBzOlxcL1xcL2NsYXNzcm9vbVxcLmdvb2dsZVxcLmNvbVxcLy87XG5cbmltcG9ydCB7XG4gIERPV05MT0FEX0lDT05fU1ZHX1VSTCxcbiAgU1VDQ0VTU19JQ09OX1NWR19VUkwsXG4gIEVSUk9SX0lDT05fU1ZHX1VSTCxcbn0gZnJvbSAnLi9pY29ucyc7XG5cbmltcG9ydCB7IGluamVjdFN0eWxlcyB9IGZyb20gJy4vc3R5bGVzJztcblxuY29uc3QgSU5KRUNURURfQVRUUiA9ICdkYXRhLWNxZC1pbmplY3RlZCc7XG5jb25zdCBSRVNDQU5fSU5URVJWQUxfTVMgPSAyMDAwO1xuY29uc3QgUkVTQ0FOX0RFQk9VTkNFX01TID0gMjUwO1xuXG4vLyBGZWVkYmFjayBkdXJhdGlvbnMgKG1zKVxuY29uc3QgTE9BRElOR19NSU5fTVMgPSA2MDA7XG5jb25zdCBGRUVEQkFDS19TVUNDRVNTX01TID0gMjAwMDtcbmNvbnN0IEZFRURCQUNLX0VSUk9SX01TID0gNDAwMDtcblxuY29uc3QgRFJJVkVfQU5DSE9SX1NFTEVDVE9SID1cbiAgJ2FbaHJlZio9XCJodHRwczovL2RyaXZlLmdvb2dsZS5jb21cIl0sIGFbaHJlZio9XCIvL2RyaXZlLmdvb2dsZS5jb21cIl0sIGFbaHJlZio9XCJjbGFzc3Jvb20uZ29vZ2xlLmNvbS9kcml2ZVwiXSc7XG5cbmNvbnN0IEFUVEFDSE1FTlRfQ09OVEFJTkVSX1NFTEVDVE9SID0gW1xuICAnLktsUlhkZicsIC8vIGNvbW1vbiBhdHRhY2htZW50IGNhcmRcbiAgJy56M3ZSY2MnLCAvLyBjaGlwLWxpa2UgYXR0YWNobWVudFxuICAnLlZmUHBrZC1hUFA3OGUnLCAvLyBNYXRlcmlhbCBjYXJkIHdyYXBwZXJcbiAgJ1tkYXRhLWRyaXZlLWlkXScsIC8vIERyaXZlIGF0dGFjaG1lbnRcbiAgJ1tkYXRhLWlkXVtkYXRhLWl0ZW0taWRdJywgLy8gbWV0YWRhdGEgYmxvY2tzXG5dLmpvaW4oJywgJyk7XG5cbmNvbnN0IERSSVZFX1VSTF9QQVRURVJOUzogUmVnRXhwW10gPSBbXG4gIC9odHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL2ZpbGVcXC9kXFwvLyxcbiAgL2h0dHBzOlxcL1xcL2RyaXZlXFwuZ29vZ2xlXFwuY29tXFwvb3BlblxcPy8sXG4gIC9odHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL3VjXFw/LyxcbiAgL2h0dHBzOlxcL1xcL2NsYXNzcm9vbVxcLmdvb2dsZVxcLmNvbVxcL2RyaXZlXFwvLyxcbl07XG5cbmxldCBzY2FuVGltZW91dElkOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbmxldCBvYnNlcnZlcjogTXV0YXRpb25PYnNlcnZlciB8IG51bGwgPSBudWxsO1xuXG50eXBlIEJ1dHRvblN0YXRlID0gJ2lkbGUnIHwgJ2xvYWRpbmcnIHwgJ3N1Y2Nlc3MnIHwgJ2Vycm9yJztcblxudHlwZSBGaWxlTWV0YSA9IHtcbiAgbmFtZT86IHN0cmluZztcbiAgZXh0Pzogc3RyaW5nO1xuICBraW5kPzogc3RyaW5nO1xufTtcblxudHlwZSBQZW5kaW5nQnV0dG9uID0ge1xuICBidXR0b246IEhUTUxCdXR0b25FbGVtZW50O1xuICByZXF1ZXN0SWQ6IHN0cmluZztcbiAgZmlsZU1ldGE/OiBGaWxlTWV0YTtcbiAgc3RhcnRlZEF0OiBudW1iZXI7XG59O1xuXG50eXBlIERvd25sb2FkU3RhdHVzID0gJ2NvbXBsZXRlJyB8ICdpbnRlcnJ1cHRlZCcgfCAnYmxvY2tlZF9odG1sJztcblxuY29uc3QgcGVuZGluZ0J1dHRvbnMgPSBuZXcgTWFwPHN0cmluZywgUGVuZGluZ0J1dHRvbj4oKTtcbmxldCBuZXh0UmVxdWVzdFNlcSA9IDE7XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBFbnZpcm9ubWVudCAvIFBhZ2UgQ2hlY2tzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBpc0dvb2dsZUNsYXNzcm9vbSgpOiBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiBsb2NhdGlvbiA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgaWYgKGxvY2F0aW9uLmhvc3RuYW1lICE9PSAnY2xhc3Nyb29tLmdvb2dsZS5jb20nKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBDTEFTU1JPT01fVVJMX1BBVFRFUk4udGVzdChsb2NhdGlvbi5ocmVmKTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFNjYW5uaW5nIC8gT2JzZXJ2ZXJzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBzY2hlZHVsZVNjYW4oKTogdm9pZCB7XG4gIGlmIChzY2FuVGltZW91dElkICE9PSBudWxsKSB7XG4gICAgd2luZG93LmNsZWFyVGltZW91dChzY2FuVGltZW91dElkKTtcbiAgfVxuICBzY2FuVGltZW91dElkID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgIHNjYW5UaW1lb3V0SWQgPSBudWxsO1xuICAgIHNjYW5Gb3JBdHRhY2htZW50cygpO1xuICB9LCBSRVNDQU5fREVCT1VOQ0VfTVMpO1xufVxuXG5mdW5jdGlvbiBzZXR1cE9ic2VydmVycygpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcblxuICBpZiAoIWRvY3VtZW50LmJvZHkpIHtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICdET01Db250ZW50TG9hZGVkJyxcbiAgICAgICgpID0+IHtcbiAgICAgICAgc2V0dXBPYnNlcnZlcnMoKTtcbiAgICAgIH0sXG4gICAgICB7IG9uY2U6IHRydWUgfSxcbiAgICApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChvYnNlcnZlcikgcmV0dXJuO1xuXG4gIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4ge1xuICAgIGNvbnN0IGhhc0NoaWxkTGlzdENoYW5nZSA9IG11dGF0aW9ucy5zb21lKFxuICAgICAgKG0pID0+XG4gICAgICAgIG0udHlwZSA9PT0gJ2NoaWxkTGlzdCcgJiZcbiAgICAgICAgKG0uYWRkZWROb2Rlcy5sZW5ndGggPiAwIHx8IG0ucmVtb3ZlZE5vZGVzLmxlbmd0aCA+IDApLFxuICAgICk7XG4gICAgaWYgKGhhc0NoaWxkTGlzdENoYW5nZSkge1xuICAgICAgc2NoZWR1bGVTY2FuKCk7XG4gICAgfVxuICB9KTtcblxuICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuXG4gIHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgc2NoZWR1bGVTY2FuKCk7XG4gIH0sIFJFU0NBTl9JTlRFUlZBTF9NUyk7XG5cbiAgc2NoZWR1bGVTY2FuKCk7XG59XG5cbmZ1bmN0aW9uIHNjYW5Gb3JBdHRhY2htZW50cygpOiB2b2lkIHtcbiAgaWYgKCFpc0dvb2dsZUNsYXNzcm9vbSgpKSByZXR1cm47XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGluamVjdFNpbmdsZUZpbGVCdXR0b25zKCk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBTaW5nbGUtZmlsZSBidXR0b25zXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBpbmplY3RTaW5nbGVGaWxlQnV0dG9ucygpOiB2b2lkIHtcbiAgY29uc3QgYW5jaG9ycyA9IEFycmF5LmZyb20oXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MQW5jaG9yRWxlbWVudD4oRFJJVkVfQU5DSE9SX1NFTEVDVE9SKSxcbiAgKTtcblxuICBmb3IgKGNvbnN0IGFuY2hvciBvZiBhbmNob3JzKSB7XG4gICAgY29uc3QgdXJsID0gZXh0cmFjdERyaXZlVXJsRnJvbUFuY2hvcihhbmNob3IpO1xuICAgIGlmICghdXJsKSBjb250aW51ZTtcblxuICAgIGNvbnN0IGNvbnRhaW5lciA9XG4gICAgICAoYW5jaG9yLmNsb3Nlc3QoQVRUQUNITUVOVF9DT05UQUlORVJfU0VMRUNUT1IpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCkgfHxcbiAgICAgIGFuY2hvci5wYXJlbnRFbGVtZW50IHx8XG4gICAgICBhbmNob3I7XG5cbiAgICBpZiAoIWNvbnRhaW5lcikgY29udGludWU7XG4gICAgaWYgKGhhc0luamVjdGVkQnV0dG9uKGNvbnRhaW5lcikpIGNvbnRpbnVlO1xuXG4gICAgaW5qZWN0QnV0dG9uSW50b0F0dGFjaG1lbnQoY29udGFpbmVyLCB1cmwpO1xuICB9XG5cbiAgY29uc3QgbWV0YUVsZW1lbnRzID0gQXJyYXkuZnJvbShcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihcbiAgICAgICdbZGF0YS1kcml2ZS1pZF0sIFtkYXRhLWlkXVtkYXRhLWl0ZW0taWRdLCBbZGF0YS1pZF1bZGF0YS10b29sdGlwXScsXG4gICAgKSxcbiAgKTtcblxuICBmb3IgKGNvbnN0IGVsIG9mIG1ldGFFbGVtZW50cykge1xuICAgIGlmIChoYXNJbmplY3RlZEJ1dHRvbihlbCkpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHVybCA9IGZpbmREcml2ZVVybChlbCk7XG4gICAgaWYgKCF1cmwpIGNvbnRpbnVlO1xuXG4gICAgaW5qZWN0QnV0dG9uSW50b0F0dGFjaG1lbnQoZWwsIHVybCk7XG4gIH1cbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFVSTCAvIERPTSBIZWxwZXJzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBoYXNJbmplY3RlZEJ1dHRvbihjb250YWluZXI6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG4gIHJldHVybiAhIWNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKGBbJHtJTkpFQ1RFRF9BVFRSfT1cInRydWVcIl1gKTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdERyaXZlVXJsRnJvbUFuY2hvcihhbmNob3I6IEhUTUxBbmNob3JFbGVtZW50KTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IGhyZWYgPSBhbmNob3IuaHJlZjtcbiAgaWYgKCFocmVmKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgaXNEcml2ZVVybCA9IERSSVZFX1VSTF9QQVRURVJOUy5zb21lKChyZSkgPT4gcmUudGVzdChocmVmKSk7XG4gIHJldHVybiBpc0RyaXZlVXJsID8gaHJlZiA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGZpbmREcml2ZVVybChlbGVtZW50OiBIVE1MRWxlbWVudCk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBuZWFyQW5jaG9yID1cbiAgICBlbGVtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEFuY2hvckVsZW1lbnQ+KERSSVZFX0FOQ0hPUl9TRUxFQ1RPUikgfHxcbiAgICAoZWxlbWVudC5jbG9zZXN0KERSSVZFX0FOQ0hPUl9TRUxFQ1RPUikgYXMgSFRNTEFuY2hvckVsZW1lbnQgfCBudWxsKTtcblxuICBpZiAobmVhckFuY2hvcikge1xuICAgIGNvbnN0IGhyZWYgPSBleHRyYWN0RHJpdmVVcmxGcm9tQW5jaG9yKG5lYXJBbmNob3IpO1xuICAgIGlmIChocmVmKSByZXR1cm4gaHJlZjtcbiAgfVxuXG4gIGNvbnN0IGRyaXZlSWQgPVxuICAgIGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLWRyaXZlLWlkJykgfHwgZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtaWQnKTtcbiAgaWYgKGRyaXZlSWQpIHtcbiAgICBjb25zdCBhbmNob3JXaXRoSWQgPVxuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MQW5jaG9yRWxlbWVudD4oXG4gICAgICAgIGBhW2RhdGEtZHJpdmUtaWQ9XCIke2RyaXZlSWR9XCJdYCxcbiAgICAgICkgfHxcbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEFuY2hvckVsZW1lbnQ+KGBhW2RhdGEtaWQ9XCIke2RyaXZlSWR9XCJdYCkgfHxcbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEFuY2hvckVsZW1lbnQ+KGBhW2hyZWYqPVwiJHtkcml2ZUlkfVwiXWApO1xuXG4gICAgaWYgKGFuY2hvcldpdGhJZCkge1xuICAgICAgY29uc3QgaHJlZiA9IGV4dHJhY3REcml2ZVVybEZyb21BbmNob3IoYW5jaG9yV2l0aElkKTtcbiAgICAgIGlmIChocmVmKSByZXR1cm4gaHJlZjtcbiAgICB9XG5cbiAgICByZXR1cm4gYGh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS91Yz9leHBvcnQ9ZG93bmxvYWQmaWQ9JHtlbmNvZGVVUklDb21wb25lbnQoXG4gICAgICBkcml2ZUlkLFxuICAgICl9YDtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiB0b0Rvd25sb2FkVXJsKG9yaWdpbmFsVXJsOiBzdHJpbmcsIGRlcHRoID0gMCk6IHN0cmluZyB7XG4gIGlmIChkZXB0aCA+IDMpIHJldHVybiBvcmlnaW5hbFVybDtcblxuICB0cnkge1xuICAgIGNvbnN0IHBhcnNlZCA9IG5ldyBVUkwob3JpZ2luYWxVcmwsIGxvY2F0aW9uLmhyZWYpO1xuICAgIGNvbnN0IGhvc3RuYW1lID0gcGFyc2VkLmhvc3RuYW1lO1xuICAgIGNvbnN0IHBhdGhuYW1lID0gcGFyc2VkLnBhdGhuYW1lO1xuXG4gICAgaWYgKGhvc3RuYW1lID09PSAnZHJpdmUuZ29vZ2xlLmNvbScpIHtcbiAgICAgIGlmIChwYXRobmFtZS5zdGFydHNXaXRoKCcvYXV0aF93YXJtdXAnKSkge1xuICAgICAgICBjb25zdCBjb250ID0gcGFyc2VkLnNlYXJjaFBhcmFtcy5nZXQoJ2NvbnRpbnVlJyk7XG4gICAgICAgIGlmIChjb250KSByZXR1cm4gdG9Eb3dubG9hZFVybChjb250LCBkZXB0aCArIDEpO1xuICAgICAgICBjb25zdCBpZCA9IHBhcnNlZC5zZWFyY2hQYXJhbXMuZ2V0KCdpZCcpO1xuICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICByZXR1cm4gYGh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS91Yz9leHBvcnQ9ZG93bmxvYWQmaWQ9JHtlbmNvZGVVUklDb21wb25lbnQoXG4gICAgICAgICAgICBpZCxcbiAgICAgICAgICApfWA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsVXJsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBmaWxlTWF0Y2ggPSBwYXRobmFtZS5tYXRjaCgvXlxcL2ZpbGVcXC9kXFwvKFteL10rKS8pO1xuICAgICAgaWYgKGZpbGVNYXRjaCkge1xuICAgICAgICBjb25zdCBpZCA9IGZpbGVNYXRjaFsxXTtcbiAgICAgICAgcmV0dXJuIGBodHRwczovL2RyaXZlLmdvb2dsZS5jb20vdWM/ZXhwb3J0PWRvd25sb2FkJmlkPSR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICAgICAgICAgIGlkLFxuICAgICAgICApfWA7XG4gICAgICB9XG5cbiAgICAgIGlmIChwYXRobmFtZSA9PT0gJy9vcGVuJykge1xuICAgICAgICBjb25zdCBpZCA9IHBhcnNlZC5zZWFyY2hQYXJhbXMuZ2V0KCdpZCcpO1xuICAgICAgICBpZiAoaWQpIHtcbiAgICAgICAgICByZXR1cm4gYGh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS91Yz9leHBvcnQ9ZG93bmxvYWQmaWQ9JHtlbmNvZGVVUklDb21wb25lbnQoXG4gICAgICAgICAgICBpZCxcbiAgICAgICAgICApfWA7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHBhdGhuYW1lID09PSAnL3VjJykge1xuICAgICAgICBwYXJzZWQuc2VhcmNoUGFyYW1zLnNldCgnZXhwb3J0JywgJ2Rvd25sb2FkJyk7XG4gICAgICAgIHJldHVybiBwYXJzZWQudG9TdHJpbmcoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaG9zdG5hbWUgPT09ICdjbGFzc3Jvb20uZ29vZ2xlLmNvbScgJiYgcGF0aG5hbWUuc3RhcnRzV2l0aCgnL2RyaXZlJykpIHtcbiAgICAgIGNvbnN0IGlkID1cbiAgICAgICAgcGFyc2VkLnNlYXJjaFBhcmFtcy5nZXQoJ2lkJykgfHxcbiAgICAgICAgcGFyc2VkLnNlYXJjaFBhcmFtcy5nZXQoJ3Jlc291cmNlSWQnKSB8fFxuICAgICAgICBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnZmlsZUlkJyk7XG4gICAgICBpZiAoaWQpIHtcbiAgICAgICAgcmV0dXJuIGBodHRwczovL2RyaXZlLmdvb2dsZS5jb20vdWM/ZXhwb3J0PWRvd25sb2FkJmlkPSR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICAgICAgICAgIGlkLFxuICAgICAgICApfWA7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9yaWdpbmFsVXJsO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gb3JpZ2luYWxVcmw7XG4gIH1cbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEZpbGUgbWV0YWRhdGEgZXh0cmFjdGlvbiAoZnJvbSBET00pXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4vLyBDbGVhbnMgZmlsZW5hbWVzIGxpa2UgXCJmaWxlLnBkZlBERlwiIC0+IFwiZmlsZS5wZGZcIlxuZnVuY3Rpb24gY2xlYW5BdHRhY2htZW50TmFtZShyYXdOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoIXJhd05hbWUpIHJldHVybiAnJztcbiAgbGV0IG5hbWUgPSByYXdOYW1lLnRyaW0oKTtcblxuICBjb25zdCBleHRlbnNpb25zID0gW1xuICAgICdwZGYnLFxuICAgICdtcDQnLFxuICAgICdtb3YnLFxuICAgICdhdmknLFxuICAgICdta3YnLFxuICAgICdqcGcnLFxuICAgICdqcGVnJyxcbiAgICAncG5nJyxcbiAgICAnZG9jeCcsXG4gICAgJ2RvYycsXG4gICAgJ3hsc3gnLFxuICAgICd4bHMnLFxuICAgICdwcHR4JyxcbiAgICAncHB0JyxcbiAgICAnemlwJyxcbiAgICAncmFyJyxcbiAgICAndHh0JyxcbiAgICAnY3N2JyxcbiAgICAnaHRtbCcsXG4gIF07XG5cbiAgY29uc3QgbG93ZXIgPSBuYW1lLnRvTG93ZXJDYXNlKCk7XG5cbiAgZm9yIChjb25zdCBleHQgb2YgZXh0ZW5zaW9ucykge1xuICAgIGNvbnN0IHBhdHRlcm4gPSBgLiR7ZXh0fSR7ZXh0fWA7IC8vIGUuZy4gLnBkZnBkZlxuICAgIGlmIChsb3dlci5lbmRzV2l0aChwYXR0ZXJuKSkge1xuICAgICAgcmV0dXJuIG5hbWUuc2xpY2UoMCwgLWV4dC5sZW5ndGgpLnRyaW0oKTtcbiAgICB9XG5cbiAgICBpZiAobG93ZXIuZW5kc1dpdGgoYC4ke2V4dH1gKSkge1xuICAgICAgcmV0dXJuIG5hbWU7XG4gICAgfVxuXG4gICAgaWYgKGxvd2VyLmVuZHNXaXRoKGAuJHtleHR9JHtleHR9YCkpIHtcbiAgICAgIHJldHVybiBuYW1lLnNsaWNlKDAsIC1leHQubGVuZ3RoKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBjb21tb25MYWJlbHMgPSBbXG4gICAgJ1BERicsXG4gICAgJ1ZpZGVvJyxcbiAgICAnSW1hZ2UnLFxuICAgICdBdWRpbycsXG4gICAgJ1RleHQnLFxuICAgICdXb3JkJyxcbiAgICAnRXhjZWwnLFxuICAgICdQb3dlclBvaW50JyxcbiAgICAnQXJjaGl2ZScsXG4gIF07XG4gIGZvciAoY29uc3QgbGFiZWwgb2YgY29tbW9uTGFiZWxzKSB7XG4gICAgaWYgKG5hbWUuZW5kc1dpdGgobGFiZWwpKSB7XG4gICAgICBjb25zdCB3aXRob3V0TGFiZWwgPSBuYW1lLnNsaWNlKDAsIC1sYWJlbC5sZW5ndGgpLnRyaW0oKTtcbiAgICAgIGlmICgvXFwuW2EtejAtOV17Miw1fSQvaS50ZXN0KHdpdGhvdXRMYWJlbCkpIHtcbiAgICAgICAgcmV0dXJuIHdpdGhvdXRMYWJlbDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmFtZTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEZpbGVNZXRhKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHVybDogc3RyaW5nKTogRmlsZU1ldGEge1xuICBsZXQgbmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0IHRvb2x0aXAgPVxuICAgIGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2RhdGEtdG9vbHRpcCcpIHx8XG4gICAgY29udGFpbmVyLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpIHx8XG4gICAgY29udGFpbmVyLmdldEF0dHJpYnV0ZSgndGl0bGUnKTtcblxuICBpZiAodG9vbHRpcCAmJiB0b29sdGlwLnRyaW0oKSkge1xuICAgIG5hbWUgPSB0b29sdGlwLnRyaW0oKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCB0ZXh0ID0gKGNvbnRhaW5lci50ZXh0Q29udGVudCB8fCAnJykudHJpbSgpO1xuICAgIGlmICh0ZXh0KSB7XG4gICAgICBjb25zdCBsaW5lcyA9IHRleHRcbiAgICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgICAubWFwKChsKSA9PiBsLnRyaW0oKSlcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIGlmIChsaW5lcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIG5hbWUgPSBsaW5lc1swXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoIW5hbWUpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdSA9IG5ldyBVUkwodXJsKTtcbiAgICAgIGNvbnN0IHBhdGhOYW1lID0gZGVjb2RlVVJJQ29tcG9uZW50KHUucGF0aG5hbWUuc3BsaXQoJy8nKS5wb3AoKSB8fCAnJyk7XG4gICAgICBpZiAocGF0aE5hbWUgJiYgcGF0aE5hbWUuaW5jbHVkZXMoJy4nKSkge1xuICAgICAgICBuYW1lID0gcGF0aE5hbWU7XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBpZ25vcmVcbiAgICB9XG4gIH1cblxuICBpZiAobmFtZSkge1xuICAgIG5hbWUgPSBjbGVhbkF0dGFjaG1lbnROYW1lKG5hbWUpO1xuICB9XG5cbiAgbGV0IGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBpZiAobmFtZSkge1xuICAgIGNvbnN0IG0gPSBuYW1lLm1hdGNoKC9cXC4oW2EtekEtWjAtOV17MSw2fSkkLyk7XG4gICAgaWYgKG0pIGV4dCA9IG1bMV0udG9Mb3dlckNhc2UoKTtcbiAgfVxuXG4gIGlmICghZXh0KSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHUgPSBuZXcgVVJMKHVybCk7XG4gICAgICBjb25zdCBwYXRoID0gdS5wYXRobmFtZTtcbiAgICAgIGNvbnN0IG0yID0gcGF0aC5tYXRjaCgvXFwuKFthLXpBLVowLTldezEsNn0pJC8pO1xuICAgICAgaWYgKG0yKSBleHQgPSBtMlsxXS50b0xvd2VyQ2FzZSgpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gaWdub3JlXG4gICAgfVxuICB9XG5cbiAgbGV0IGtpbmQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgaWYgKGV4dCkge1xuICAgIGlmIChbJ3BkZiddLmluY2x1ZGVzKGV4dCkpIGtpbmQgPSAncGRmJztcbiAgICBlbHNlIGlmIChbJ2RvYycsICdkb2N4J10uaW5jbHVkZXMoZXh0KSkga2luZCA9ICdkb2MnO1xuICAgIGVsc2UgaWYgKFsneGxzJywgJ3hsc3gnLCAnY3N2J10uaW5jbHVkZXMoZXh0KSkga2luZCA9ICdzaGVldCc7XG4gICAgZWxzZSBpZiAoWydwcHQnLCAncHB0eCddLmluY2x1ZGVzKGV4dCkpIGtpbmQgPSAnc2xpZGUnO1xuICAgIGVsc2UgaWYgKFsnanBnJywgJ2pwZWcnLCAncG5nJywgJ2dpZicsICd3ZWJwJ10uaW5jbHVkZXMoZXh0KSlcbiAgICAgIGtpbmQgPSAnaW1hZ2UnO1xuICAgIGVsc2UgaWYgKFsnemlwJywgJ3JhcicsICc3eiddLmluY2x1ZGVzKGV4dCkpIGtpbmQgPSAnYXJjaGl2ZSc7XG4gICAgZWxzZSBpZiAoWydtcDQnLCAnbW92JywgJ21rdicsICdhdmknXS5pbmNsdWRlcyhleHQpKSBraW5kID0gJ3ZpZGVvJztcbiAgICBlbHNlIGlmIChbJ2h0bWwnLCAnaHRtJ10uaW5jbHVkZXMoZXh0KSkga2luZCA9ICdodG1sJztcbiAgICBlbHNlIGtpbmQgPSAnb3RoZXInO1xuICB9XG5cbiAgcmV0dXJuIHsgbmFtZSwgZXh0LCBraW5kIH07XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCdXR0b24gaW5qZWN0aW9uXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBpbmplY3RCdXR0b25JbnRvQXR0YWNobWVudChjb250YWluZXI6IEhUTUxFbGVtZW50LCB1cmw6IHN0cmluZyk6IHZvaWQge1xuICBpZiAoIXVybCkgcmV0dXJuO1xuXG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoY29udGFpbmVyKTtcbiAgaWYgKGNvbXB1dGVkLnBvc2l0aW9uID09PSAnc3RhdGljJykge1xuICAgIGNvbnRhaW5lci5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gIH1cblxuICBjb25zdCBkaXJlY3RVcmwgPSB0b0Rvd25sb2FkVXJsKHVybCk7XG4gIGNvbnN0IGZpbGVNZXRhID0gZXh0cmFjdEZpbGVNZXRhKGNvbnRhaW5lciwgZGlyZWN0VXJsKTtcbiAgY29uc3QgYnV0dG9uID0gY3JlYXRlRG93bmxvYWRCdXR0b24oY29udGFpbmVyLCBkaXJlY3RVcmwsIGZpbGVNZXRhKTtcblxuICBjb25zdCBpY29uRWwgPSBidXR0b24ucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtZG93bmxvYWQtaWNvbicpO1xuICBpZiAoaWNvbkVsKSB7XG4gICAgaWNvbkVsLmNsYXNzTGlzdC5hZGQoJ2NxZC1pY29uLW1lZGl1bScpO1xuICB9XG5cbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKGJ1dHRvbik7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCdXR0b24gc3RhdGUgaGVscGVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gZ2V0QnV0dG9uU3RhdGUoYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCk6IEJ1dHRvblN0YXRlIHtcbiAgaWYgKGJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2NxZC1sb2FkaW5nJykpIHJldHVybiAnbG9hZGluZyc7XG4gIGlmIChidXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtc3VjY2VzcycpKSByZXR1cm4gJ3N1Y2Nlc3MnO1xuICBpZiAoYnV0dG9uLmNsYXNzTGlzdC5jb250YWlucygnY3FkLWVycm9yJykpIHJldHVybiAnZXJyb3InO1xuICByZXR1cm4gJ2lkbGUnO1xufVxuXG5mdW5jdGlvbiBzZXRCdXR0b25TdGF0ZShcbiAgYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCxcbiAgc3RhdGU6IEJ1dHRvblN0YXRlLFxuICBvcHRpb25zPzogeyB1c2VyTWVzc2FnZT86IHN0cmluZyB9LFxuKTogdm9pZCB7XG4gIGNvbnN0IGljb24gPSBidXR0b24ucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtZG93bmxvYWQtaWNvbicpO1xuICBjb25zdCBsYWJlbCA9IGJ1dHRvbi5xdWVyeVNlbGVjdG9yPEhUTUxTcGFuRWxlbWVudD4oJy5jcWQtbGFiZWwnKTtcbiAgY29uc3QgZXJyb3JEZXRhaWwgPSBidXR0b24ucXVlcnlTZWxlY3RvcjxIVE1MU3BhbkVsZW1lbnQ+KFxuICAgICcuY3FkLWVycm9yLWRldGFpbCcsXG4gICk7XG4gIGlmICghaWNvbiB8fCAhbGFiZWwgfHwgIWVycm9yRGV0YWlsKSByZXR1cm47XG5cbiAgLy8gUmVzZXQgYWxsIHN0YXRlIGNsYXNzZXMgLyBzdHlsZXNcbiAgYnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoJ2NxZC1sb2FkaW5nJywgJ2NxZC1zdWNjZXNzJywgJ2NxZC1lcnJvcicpO1xuICBpY29uLmNsYXNzTGlzdC5yZW1vdmUoJ2NxZC1zcGlubmVyJyk7XG4gIGljb24udGV4dENvbnRlbnQgPSAnJztcbiAgYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gIGJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnIzFhNzNlOCc7XG4gIGxhYmVsLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkJztcbiAgZXJyb3JEZXRhaWwudGV4dENvbnRlbnQgPSAnJztcblxuICAvLyBEZWZhdWx0OiBkb3dubG9hZCBpY29uXG4gIGljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKWA7XG4gIGljb24uc3R5bGUuYmFja2dyb3VuZFNpemUgPSAnJztcblxuICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgY2FzZSAnaWRsZSc6XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2xvYWRpbmcnOlxuICAgICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2NxZC1sb2FkaW5nJyk7XG4gICAgICBidXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSAnRG93bmxvYWRpbmfigKYnO1xuICAgICAgaWNvbi5jbGFzc0xpc3QuYWRkKCdjcWQtc3Bpbm5lcicpO1xuICAgICAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAnbm9uZSc7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ3N1Y2Nlc3MnOlxuICAgICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2NxZC1zdWNjZXNzJyk7XG4gICAgICBidXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyMxODgwMzgnOyAvLyBHb29nbGUgZ3JlZW5cbiAgICAgIGxhYmVsLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkZWQnO1xuICAgICAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgdXJsKFwiJHtTVUNDRVNTX0lDT05fU1ZHX1VSTH1cIilgO1xuICAgICAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kU2l6ZSA9ICcyMHB4IDIwcHgnO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdlcnJvcic6XG4gICAgICBidXR0b24uY2xhc3NMaXN0LmFkZCgnY3FkLWVycm9yJyk7XG4gICAgICBidXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyNlMDU5NTInO1xuICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSAnRXJyb3InO1xuICAgICAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgdXJsKFwiJHtFUlJPUl9JQ09OX1NWR19VUkx9XCIpYDtcbiAgICAgIGljb24uc3R5bGUuYmFja2dyb3VuZFNpemUgPSAnMjBweCAyMHB4JztcbiAgICAgIGVycm9yRGV0YWlsLnRleHRDb250ZW50ID1cbiAgICAgICAgb3B0aW9ucz8udXNlck1lc3NhZ2UgfHxcbiAgICAgICAgJ1NvbWV0aGluZyB3ZW50IHdyb25nIHdoaWxlIGRvd25sb2FkaW5nIHRoaXMgZmlsZS4nO1xuICAgICAgYnJlYWs7XG4gIH1cbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEJ1dHRvbiBmYWN0b3J5XG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBjcmVhdGVEb3dubG9hZEJ1dHRvbihcbiAgX2NvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG4gIHVybDogc3RyaW5nLFxuICBmaWxlTWV0YTogRmlsZU1ldGEsXG4pOiBIVE1MQnV0dG9uRWxlbWVudCB7XG4gIGNvbnN0IGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICBidXR0b24udHlwZSA9ICdidXR0b24nO1xuICBidXR0b24uY2xhc3NOYW1lID0gJ2NxZC1kb3dubG9hZC1idG4nO1xuICBidXR0b24uc2V0QXR0cmlidXRlKElOSkVDVEVEX0FUVFIsICd0cnVlJyk7XG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnUXVpY2sgZG93bmxvYWQgYXR0YWNobWVudCcpO1xuICBidXR0b24uc2V0QXR0cmlidXRlKCd0aXRsZScsICdRdWljayBkb3dubG9hZCcpO1xuXG4gIGNvbnN0IGljb25XcmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBpY29uV3JhcHBlci5jbGFzc05hbWUgPSAnY3FkLWljb24td3JhcHBlcic7XG5cbiAgY29uc3QgaWNvblNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGljb25TcGFuLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtaWNvbic7XG4gIGljb25XcmFwcGVyLmFwcGVuZENoaWxkKGljb25TcGFuKTtcblxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgbGFiZWwuY2xhc3NOYW1lID0gJ2NxZC1sYWJlbCc7XG4gIGxhYmVsLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkJztcblxuICBjb25zdCBlcnJvckRldGFpbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgZXJyb3JEZXRhaWwuY2xhc3NOYW1lID0gJ2NxZC1lcnJvci1kZXRhaWwnO1xuICBlcnJvckRldGFpbC50ZXh0Q29udGVudCA9ICcnO1xuXG4gIGJ1dHRvbi5hcHBlbmRDaGlsZChpY29uV3JhcHBlcik7XG4gIGJ1dHRvbi5hcHBlbmRDaGlsZChsYWJlbCk7XG4gIGJ1dHRvbi5hcHBlbmRDaGlsZChlcnJvckRldGFpbCk7XG5cbiAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBhd2FpdCBoYW5kbGVTaW5nbGVEb3dubG9hZENsaWNrKGJ1dHRvbiwgdXJsLCBmaWxlTWV0YSk7XG4gIH0pO1xuXG4gIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdhdXhjbGljaycsIGFzeW5jIChldmVudCkgPT4ge1xuICAgIGlmIChldmVudC5idXR0b24gIT09IDEpIHJldHVybjsgLy8gbWlkZGxlLWNsaWNrIG9ubHlcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGF3YWl0IGhhbmRsZVNpbmdsZURvd25sb2FkQ2xpY2soYnV0dG9uLCB1cmwsIGZpbGVNZXRhKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGJ1dHRvbjtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFNpbmdsZSBkb3dubG9hZCBmbG93IHdpdGggSU1NRURJQVRFIHN1Y2Nlc3MvZXJyb3JcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZVNpbmdsZURvd25sb2FkQ2xpY2soXG4gIGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQsXG4gIHVybDogc3RyaW5nLFxuICBmaWxlTWV0YTogRmlsZU1ldGEsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCF1cmwpIHJldHVybjtcblxuICBjb25zdCBjdXJyZW50U3RhdGUgPSBnZXRCdXR0b25TdGF0ZShidXR0b24pO1xuICBpZiAoY3VycmVudFN0YXRlICE9PSAnaWRsZScpIHJldHVybjtcblxuICBjb25zdCByZXF1ZXN0SWQgPSBgY3FkLSR7RGF0ZS5ub3coKX0tJHtuZXh0UmVxdWVzdFNlcSsrfWA7XG4gIGNvbnN0IHN0YXJ0ZWRBdCA9IERhdGUubm93KCk7XG5cbiAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnbG9hZGluZycpO1xuXG4gIGNvbnN0IHN0YXJ0UmVzdWx0ID0gYXdhaXQgc3RhcnRCYWNrZ3JvdW5kRG93bmxvYWQocmVxdWVzdElkLCB1cmwsIGZpbGVNZXRhKTtcblxuICAvLyBXZSBzdGlsbCBrZWVwIGEgdGlueSBzcGlubmVyIHRpbWUgZm9yIHZpc3VhbCBzbW9vdGhuZXNzXG4gIGF3YWl0IGVuc3VyZU1pbkxvYWRpbmcoc3RhcnRlZEF0KTtcblxuICBpZiAoIXN0YXJ0UmVzdWx0Lm9rKSB7XG4gICAgYXdhaXQgc2hvd0Vycm9yU3RhdGUoYnV0dG9uLCBzdGFydFJlc3VsdC51c2VyTWVzc2FnZSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8g4pyFIElNTUVESUFURSBTVUNDRVNTOiBicm93c2VyIGFjY2VwdGVkIHRoZSBkb3dubG9hZFxuICBzZXRCdXR0b25TdGF0ZShidXR0b24sICdzdWNjZXNzJyk7XG5cbiAgLy8gT3B0aW9uYWxseSByZXR1cm4gdG8gaWRsZSBzbyB0aGUgdXNlciBjYW4gY2xpY2sgYWdhaW5cbiAgYXdhaXQgZGVsYXkoRkVFREJBQ0tfU1VDQ0VTU19NUyk7XG4gIGlmIChnZXRCdXR0b25TdGF0ZShidXR0b24pID09PSAnc3VjY2VzcycpIHtcbiAgICBzZXRCdXR0b25TdGF0ZShidXR0b24sICdpZGxlJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RhcnRCYWNrZ3JvdW5kRG93bmxvYWQoXG4gIHJlcXVlc3RJZDogc3RyaW5nLFxuICB1cmw6IHN0cmluZyxcbiAgZmlsZU1ldGE6IEZpbGVNZXRhLFxuKTogUHJvbWlzZTx7IG9rOiBib29sZWFuOyB1c2VyTWVzc2FnZT86IHN0cmluZyB9PiB7XG4gIGNvbnN0IGZpbmFsVXJsID0gdG9Eb3dubG9hZFVybCh1cmwpO1xuXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgIGlmICh0eXBlb2YgY2hyb21lID09PSAndW5kZWZpbmVkJyB8fCAhY2hyb21lLnJ1bnRpbWU/LnNlbmRNZXNzYWdlKSB7XG4gICAgICByZXNvbHZlKHtcbiAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICB1c2VyTWVzc2FnZTogJ1RoZSBleHRlbnNpb24gcnVudGltZSBpcyBub3QgYXZhaWxhYmxlLiBSZWxvYWQgcGFnZS4nLFxuICAgICAgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKFxuICAgICAgICB7XG4gICAgICAgICAgdHlwZTogJ0NRRF9ET1dOTE9BRCcsXG4gICAgICAgICAgdXJsOiBmaW5hbFVybCxcbiAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgZmlsZU1ldGEsXG4gICAgICAgIH0sXG4gICAgICAgIChyZXNwb25zZT86IHtcbiAgICAgICAgICBzdGFydGVkPzogYm9vbGVhbjtcbiAgICAgICAgICByZXF1ZXN0SWQ/OiBzdHJpbmc7XG4gICAgICAgICAgdXNlck1lc3NhZ2U/OiBzdHJpbmc7XG4gICAgICAgIH0pID0+IHtcbiAgICAgICAgICBjb25zdCBlcnIgPSBjaHJvbWUucnVudGltZS5sYXN0RXJyb3I7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbQ1FEXSBzZW5kTWVzc2FnZSBlcnJvcjonLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICByZXNvbHZlKHtcbiAgICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgICB1c2VyTWVzc2FnZTogJ0Nvbm5lY3Rpb24gdG8gZXh0ZW5zaW9uIGZhaWxlZC4nLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFyZXNwb25zZSB8fCByZXNwb25zZS5zdGFydGVkID09PSBmYWxzZSkge1xuICAgICAgICAgICAgcmVzb2x2ZSh7XG4gICAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgICAgdXNlck1lc3NhZ2U6XG4gICAgICAgICAgICAgICAgcmVzcG9uc2U/LnVzZXJNZXNzYWdlIHx8ICdDb3VsZCBub3Qgc3RhcnQgdGhlIGRvd25sb2FkLicsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyDinIUgQnJvd3NlciBhY2NlcHRlZCB0aGUgZG93bmxvYWRcbiAgICAgICAgICByZXNvbHZlKHsgb2s6IHRydWUgfSk7XG4gICAgICAgIH0sXG4gICAgICApO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUud2FybignW0NRRF0gc2VuZE1lc3NhZ2UgdGhyZXc6JywgZSk7XG4gICAgICByZXNvbHZlKHtcbiAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICB1c2VyTWVzc2FnZTogJ0V4dGVuc2lvbiBjb21tdW5pY2F0aW9uIGVycm9yLicsXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogSGFuZGxlIGRvd25sb2FkIHN0YXR1cyBtZXNzYWdlcyBmcm9tIGJhY2tncm91bmRcbiAqIChOb3cgZWZmZWN0aXZlbHkgdW51c2VkLCBidXQga2VwdCBpbiBjYXNlIHlvdSB3YW50XG4gKiAgdG8gcmVhY3QgdG8gc3BlY2lhbCBzdGF0dXNlcyBsYXRlci4pXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBzZXR1cERvd25sb2FkU3RhdHVzTGlzdGVuZXIoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgY2hyb21lID09PSAndW5kZWZpbmVkJyB8fCAhY2hyb21lLnJ1bnRpbWU/Lm9uTWVzc2FnZSkgcmV0dXJuO1xuXG4gIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgX3NlbmRlciwgX3NlbmRSZXNwb25zZSkgPT4ge1xuICAgIGlmICghbWVzc2FnZSB8fCBtZXNzYWdlLnR5cGUgIT09ICdDUURfRE9XTkxPQURfU1RBVFVTJykgcmV0dXJuO1xuXG4gICAgY29uc3Qge1xuICAgICAgcmVxdWVzdElkLFxuICAgICAgc3RhdHVzLFxuICAgICAgdXNlck1lc3NhZ2UsXG4gICAgfToge1xuICAgICAgcmVxdWVzdElkOiBzdHJpbmc7XG4gICAgICBzdGF0dXM6IERvd25sb2FkU3RhdHVzO1xuICAgICAgdXNlck1lc3NhZ2U/OiBzdHJpbmc7XG4gICAgfSA9IG1lc3NhZ2U7XG5cbiAgICBjb25zdCBwZW5kaW5nID0gcGVuZGluZ0J1dHRvbnMuZ2V0KHJlcXVlc3RJZCk7XG4gICAgaWYgKCFwZW5kaW5nKSByZXR1cm47XG5cbiAgICAvLyBXaXRoIHRoZSBuZXcgZmxvdyB3ZSBkb24ndCBhY3R1YWxseSBwb3B1bGF0ZSBwZW5kaW5nQnV0dG9ucyxcbiAgICAvLyBzbyB0aGlzIHdvbid0IHJ1bi4gTGVmdCBoZXJlIGZvciBwb3NzaWJsZSBmdXR1cmUgdXNlLlxuICAgIHZvaWQgaGFuZGxlRG93bmxvYWRTdGF0dXNGb3JCdXR0b24ocGVuZGluZywgc3RhdHVzLCB1c2VyTWVzc2FnZSk7XG4gIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVEb3dubG9hZFN0YXR1c0ZvckJ1dHRvbihcbiAgcGVuZGluZzogUGVuZGluZ0J1dHRvbixcbiAgc3RhdHVzOiBEb3dubG9hZFN0YXR1cyxcbiAgdXNlck1lc3NhZ2U/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgeyBidXR0b24sIHN0YXJ0ZWRBdCwgcmVxdWVzdElkIH0gPSBwZW5kaW5nO1xuXG4gIGF3YWl0IGVuc3VyZU1pbkxvYWRpbmcoc3RhcnRlZEF0KTtcblxuICBpZiAoc3RhdHVzID09PSAnY29tcGxldGUnKSB7XG4gICAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnc3VjY2VzcycpO1xuICAgIGF3YWl0IGRlbGF5KEZFRURCQUNLX1NVQ0NFU1NfTVMpO1xuICAgIHNldEJ1dHRvblN0YXRlKGJ1dHRvbiwgJ2lkbGUnKTtcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBzaG93RXJyb3JTdGF0ZShidXR0b24sIHVzZXJNZXNzYWdlKTtcbiAgfVxuXG4gIHBlbmRpbmdCdXR0b25zLmRlbGV0ZShyZXF1ZXN0SWQpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzaG93RXJyb3JTdGF0ZShcbiAgYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCxcbiAgdXNlck1lc3NhZ2U/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnZXJyb3InLCB7IHVzZXJNZXNzYWdlIH0pO1xuXG4gIGNvbnN0IGVhcmxpZXN0UmVzZXQgPSBEYXRlLm5vdygpICsgRkVFREJBQ0tfRVJST1JfTVM7XG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBhd2FpdCBkZWxheSgyMDApO1xuXG4gICAgaWYgKGdldEJ1dHRvblN0YXRlKGJ1dHRvbikgIT09ICdlcnJvcicpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgIGlmIChub3cgPCBlYXJsaWVzdFJlc2V0KSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCBob3ZlcmVkID0gYnV0dG9uLm1hdGNoZXMoJzpob3ZlcicpO1xuICAgIGlmICghaG92ZXJlZCkge1xuICAgICAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnaWRsZScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVNaW5Mb2FkaW5nKHN0YXJ0ZWRBdDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGVsYXBzZWQgPSBEYXRlLm5vdygpIC0gc3RhcnRlZEF0O1xuICBpZiAoZWxhcHNlZCA8IExPQURJTkdfTUlOX01TKSB7XG4gICAgYXdhaXQgZGVsYXkoTE9BRElOR19NSU5fTVMgLSBlbGFwc2VkKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBkZWxheShtczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gd2luZG93LnNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEluaXRcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGluaXRDb250ZW50U2NyaXB0KCk6IHZvaWQge1xuICBpZiAoIWlzR29vZ2xlQ2xhc3Nyb29tKCkpIHJldHVybjtcbiAgaW5qZWN0U3R5bGVzKCk7XG4gIHNldHVwRG93bmxvYWRTdGF0dXNMaXN0ZW5lcigpOyAvLyBoYXJtbGVzcyBub3c7IG5vIHBlbmRpbmdCdXR0b25zXG4gIHNldHVwT2JzZXJ2ZXJzKCk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbnRlbnRTY3JpcHQoe1xuICBtYXRjaGVzOiBbJ2h0dHBzOi8vY2xhc3Nyb29tLmdvb2dsZS5jb20vKiddLFxuICBydW5BdDogJ2RvY3VtZW50X2lkbGUnLFxuICBtYWluKCkge1xuICAgIGluaXRDb250ZW50U2NyaXB0KCk7XG4gIH0sXG59KTtcbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2AgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJwcmludCIsImxvZ2dlciJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLG9CQUFvQkEsYUFBWTtBQUM5QyxXQUFPQTtBQUFBLEVBQ1Q7QUNDTyxRQUFNLHdCQUF3QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBUzlCLFFBQU0sdUJBQXVCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVU3QixRQUFNLHFCQUFxQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFRM0IsUUFBTSx3QkFBd0IsMkJBQTJCO0FBQUEsSUFDOUQ7QUFBQSxFQUNGLENBQUM7QUFFTSxRQUFNLHVCQUF1QiwyQkFBMkI7QUFBQSxJQUM3RDtBQUFBLEVBQ0YsQ0FBQztBQUVNLFFBQU0scUJBQXFCLDJCQUEyQjtBQUFBLElBQzNEO0FBQUEsRUFDRixDQUFDO0FDckNELFFBQU0sV0FBVztBQUNqQixRQUFNLGtCQUFrQjtBQUd4QixRQUFNLGdCQUFnQjtBQUN0QixRQUFNLGlCQUFpQixHQUFHLGFBQWE7QUFFaEMsV0FBUyxlQUFxQjtBQUNuQyxRQUFJLE9BQU8sYUFBYSxZQUFhO0FBQ3JDLFFBQUksU0FBUyxlQUFlLFFBQVEsRUFBRztBQUV2QyxVQUFNLFFBQVEsU0FBUyxjQUFjLE9BQU87QUFDNUMsVUFBTSxLQUFLO0FBQ1gsVUFBTSxjQUFjO0FBQUE7QUFBQSwwQkFFSSxjQUFjO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsK0JBMkZULHFCQUFxQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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LFlBQUE7QUFFQSxVQUFBLFdBQUEsU0FBQSxjQUFBLE1BQUE7QUFDQSxhQUFBLFlBQUE7QUFDQSxnQkFBQSxZQUFBLFFBQUE7QUFFQSxVQUFBLFFBQUEsU0FBQSxjQUFBLE1BQUE7QUFDQSxVQUFBLFlBQUE7QUFDQSxVQUFBLGNBQUE7QUFFQSxVQUFBLGNBQUEsU0FBQSxjQUFBLE1BQUE7QUFDQSxnQkFBQSxZQUFBO0FBQ0EsZ0JBQUEsY0FBQTtBQUVBLFdBQUEsWUFBQSxXQUFBO0FBQ0EsV0FBQSxZQUFBLEtBQUE7QUFDQSxXQUFBLFlBQUEsV0FBQTtBQUVBLFdBQUEsaUJBQUEsU0FBQSxPQUFBLFVBQUE7QUFDRSxZQUFBLGVBQUE7QUFDQSxZQUFBLGdCQUFBO0FBQ0EsWUFBQSwwQkFBQSxRQUFBLEtBQUEsUUFBQTtBQUFBLElBQXFELENBQUE7QUFHdkQsV0FBQSxpQkFBQSxZQUFBLE9BQUEsVUFBQTtBQUNFLFVBQUEsTUFBQSxXQUFBLEVBQUE7QUFDQSxZQUFBLGVBQUE7QUFDQSxZQUFBLGdCQUFBO0FBQ0EsWUFBQSwwQkFBQSxRQUFBLEtBQUEsUUFBQTtBQUFBLElBQXFELENBQUE7QUFHdkQsV0FBQTtBQUFBLEVBQ0Y7QUFNQSxpQkFBQSwwQkFBQSxRQUFBLEtBQUEsVUFBQTtBQUtFLFFBQUEsQ0FBQSxJQUFBO0FBRUEsVUFBQSxlQUFBLGVBQUEsTUFBQTtBQUNBLFFBQUEsaUJBQUEsT0FBQTtBQUVBLFVBQUEsWUFBQSxPQUFBLEtBQUEsSUFBQSxDQUFBLElBQUEsZ0JBQUE7QUFDQSxVQUFBLFlBQUEsS0FBQSxJQUFBO0FBRUEsbUJBQUEsUUFBQSxTQUFBO0FBRUEsVUFBQSxjQUFBLE1BQUEsd0JBQUEsV0FBQSxLQUFBLFFBQUE7QUFHQSxVQUFBLGlCQUFBLFNBQUE7QUFFQSxRQUFBLENBQUEsWUFBQSxJQUFBO0FBQ0UsWUFBQSxlQUFBLFFBQUEsWUFBQSxXQUFBO0FBQ0E7QUFBQSxJQUFBO0FBSUYsbUJBQUEsUUFBQSxTQUFBO0FBR0EsVUFBQSxNQUFBLG1CQUFBO0FBQ0EsUUFBQSxlQUFBLE1B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
content;